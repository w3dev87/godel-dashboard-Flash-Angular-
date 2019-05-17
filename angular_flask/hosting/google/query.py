'''
Fix for appengine: DeadlineExceededError: Deadline exceeded while waiting for HTTP response from URL:

httplib2: __init__.py

       def fixed_fetch(url, payload=None, method="GET", headers={},
                       allow_truncated=False, follow_redirects=True,
                      deadline=60):
           return fetch(url, payload=payload, method=method, headers=headers,
                        allow_truncated=allow_truncated,
                       follow_redirects=follow_redirects, deadline=60,
                        validate_certificate=validate_certificate)
       return fixed_fetch

Change deadline to 60s[max] to avoid DeadlineExceededErrors in appengine:
http://stackoverflow.com/questions/13051628/gae-appengine-deadlineexceedederror-deadline-exceeded-while-waiting-for-htt
'''


from googleapiclient.discovery import build
from oauth2client.client import flow_from_clientsecrets
import httplib2
from google.appengine.api import memcache
from angular_flask import app
import cache
import time
import datetime
import zlib, sys
import os
import csv
import random
import logging
import traceback
import uuid

from apiclient import discovery
from oauth2client import appengine

from oauth2client.file import Storage
from google.appengine.ext import db
from oauth2client.appengine import CredentialsProperty
#from google.appengine.api import users
from oauth2client.appengine import StorageByKeyName
from angular_flask.hosting.google.auth import CredentialsModel
from google.appengine.api import urlfetch
from ..services import bill


from google.appengine.runtime import apiproxy_errors

from PyCryptoSignedJWT import PyCryptoSignedJwtAssertionCredentials
from ..services import Query
import users

import binascii, json
from collections import defaultdict
from flask import jsonify
from itertools import izip
from flask.ext.restful import abort

project_id = 'godel-big-q'

#urlfetch.set_default_fetch_deadline(60)
cache = cache.Cache()
userservice = users.Users()

def extract_from_cache(domain, query):
    try:
        return json.loads(zlib.decompress(cache.get(domain, query)))
    except:
        return None


class Query(Query):

    def execute(self, bq_query, query_type, uid,is_realtime=False):
        start = time.time()
        domain = userservice.get_domain(uid)
        if is_realtime:
            query_response = None
            bq_query = bq_query.replace('godel_logs.godel_session','godel_logs.godel_realtime')
        else:
            query_response = extract_from_cache(domain, bq_query)


        if(query_response is None):
            big_query = _BigQuery(uid)

            start = time.time()
            # print ('query===================',bq_query)
            app.logger.info('Starting Query: ' + bq_query)
            query_response = big_query.run_in_big_query(bq_query,uid)
            app.logger.info('Execution time: %fs' % (time.time() - start))

            if not query_response:
                abort(404)
            elif 'rows' not in query_response.keys():
                if query_type == "customer_list":
                    return {}
                else:
                    abort(404)

            cache.put(domain, bq_query, zlib.compress(json.dumps(query_response)), 900)
        else:
            app.logger.info('Starting Query: ' + bq_query)
            app.logger.info("Fetched from Cache :)")

        if not query_response:
            abort(404)
        elif 'totalRows' in query_response.keys() and query_response['totalRows'] == '0':
            if query_type == "customer_list":
                return {}
            else:
                abort(404)
        if query_type == "custom_query":
            temp = {}
            temp['totalRows'] = query_response['totalRows'];
            temp['rows'] = query_response['rows'];
            temp['schema'] = query_response['schema'];
            return temp
        return format_resp_tojson(query_response,query_type)

    def stream_it(self,project_id, dataset_id, table_id,rows):
        big_query = _BigQuery(uid='rinil@juspay.in')
        return big_query.stream_row_to_bigquery(project_id, dataset_id, table_id,rows)


def with_retry(fn):
    try:
        return fn()
    except apiproxy_errors.DeadlineExceededError:
        app.logger.info( 'BQ: urlfetch timeout. DeadlineExceededError. retrying..')
        try:
            return fn()
        except apiproxy_errors.DeadlineExceededError:
            app.logger.error( 'BQ: urlfetch timeout.' + traceback.format_exc())


class _BigQuery(object):
    def __init__(self,uid):
        # storage = StorageByKeyName(CredentialsModel, uid, 'credentials')
        # self.credentials = storage.get()
        dirname, filename = os.path.split(os.path.abspath(__file__))
        self.key = open(dirname + '/privatekey.pem').read()
        # self.service_email = "1007191595415-93936jvd5b17g9vhd3iqt6qrfq6douum@developer.gserviceaccount.com"
        self.service_email = "backend-auth-v2@godel-big-q.iam.gserviceaccount.com"
        self.scope = "https://www.googleapis.com/auth/bigquery"
        self.credentials = PyCryptoSignedJwtAssertionCredentials(
            service_account_name=self.service_email,
            private_key=self.key,
            scope=self.scope
        )
        self.authenticateService()

    def authenticateService(self):
        credentials = self.credentials
        http = credentials.authorize(httplib2.Http())
        service = build(serviceName='bigquery', version='v2', http=http)
        self.service = service


    def run_in_big_query(self, sql,uid):
        jobCollection = self.service.jobs()
        queryData = {'query':sql, 'timeoutMs': 3000}
        queryResponse = with_retry(lambda: jobCollection.query(projectId=project_id, body=queryData).execute())
        job_id = queryResponse['jobReference']['jobId']
        #cost = bytes_processed
        cost =0


        def __fetch_results(current_row=0):
            return with_retry(lambda: jobCollection.getQueryResults(
                        projectId=project_id,
                        jobId=job_id,
                        startIndex=current_row,
                        timeoutMs=4000).execute())

        while not queryResponse['jobComplete']:
            queryResponse = __fetch_results()

        full_queryResponse = queryResponse
        while len(full_queryResponse['rows']) < int(queryResponse['totalRows']):
            queryResponse = __fetch_results(len(full_queryResponse))
            full_queryResponse['rows'] += queryResponse['rows']

        if 'rows' not in full_queryResponse:
            app.logger.error( "No response" )
            abort(404)
        if len(full_queryResponse['rows']) == 0:
            app.logger.error( "No response" )
            abort(404)
        if (int(queryResponse['totalRows'])/(len(full_queryResponse['rows']))) > 10:
            app.logger.error( "Aborting! size > 50MB" )
            abort(404)
        bytes_processed = full_queryResponse['totalBytesProcessed']
        user = userservice.getAppname(uid)
        email = uid
        bill.input_info(job_id, bytes_processed,user,email)
        return full_queryResponse


    def stream_row_to_bigquery(self,project_id, dataset_id, table_id,rows):
        start = time.time()
        idx = int((time.time()*1000000))
        job_id = 'bq_job_%d' % idx
        jobCollection = self.service.tabledata()
        insert_all_data = {
                            'rows': rows
                         }
        result = jobCollection.insertAll(
                    projectId=project_id,
                    datasetId=dataset_id,
                    tableId=table_id,
                    body=insert_all_data).execute(num_retries=5)

        if result.get('insertErrors'):
            for err in result.get('insertErrors'):
                app.logger.error( ''' The row at index:{index} has an Error:{error}'''.format(index=err.get('index'),error=err.get('errors')))


# Formatting bigQuery response
def format_resp_tojson(query_response, qtype):
    out = defaultdict(dict)
    d = defaultdict(list)
    column = []
    for index,itr in enumerate(query_response['schema']['fields']):
        column.append(itr['name'])
        if (itr['type'] != 'STRING'):
            for i in query_response['rows']:
                if i['f'][index]['v'] != None:
                    i['f'][index]['v'] = float(i['f'][index]['v']);
    if not query_response and 'rows' not in query_response.keys():
        abort(404)
    for row in query_response['rows']:
        result_row = []
        for field in row['f']:
            result_row.append(field['v'])
        v = iter(result_row[1:])
        b = dict(izip(column[1:], v))
        d[result_row[0]].append(b)
    out = dict(out.items() + d.items())
    if qtype == 'alert' or qtype == 'dailydashbrd':
        return out
    elif qtype == 'report':
        # csv-fying
        output = ','.join([str(i) for i in out.get('reports')[0].keys()]) + '\n'
        for i in xrange(len(out.get('reports'))):
            output += ','.join([str(i) for i in out.get('reports')[i].values()]) + '\n'
        return output
    elif qtype == 'customer_list':
        obj = {'result':[]}
        for key in out:
            arr = [itr['client_id'] for itr in out[key]]
            obj['result'].append({'appName':key,'clientId':arr})
        out = obj
    return jsonify(out)

