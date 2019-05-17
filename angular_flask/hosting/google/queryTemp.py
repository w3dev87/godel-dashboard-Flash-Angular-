
from apiclient.discovery import build
from oauth2client.client import flow_from_clientsecrets
import httplib2
from google.appengine.api import memcache
from angular_flask import app
import cache
import time
from oauth2client.file import Storage
from google.appengine.ext import db
from oauth2client.appengine import CredentialsProperty
from google.appengine.api import users
from oauth2client.appengine import StorageByKeyName
from angular_flask.hosting.google.auth import CredentialsModel

project_id = 'godel-big-q'

class APIAuthenticator(object):

	def __init__(self, credentials, projectId):
		self.credentials = credentials
		self.projectId = projectId

	
class Query(object):
	
	def __init__(self):
		self.api = None
		self.service = None
		self.cache = None

	def authenticateService(self):
		if self.service == None:
			credentials = self.api.credentials
			http = credentials.authorize(httplib2.Http())
    		service = build('bigquery', 'v2', http=http)
    		self.service = service
    		app.logger.info(self.service)
    		app.logger.info(self.api.credentials)
    		app.logger.info(self.api.projectId)
    
	def run_in_big_query(self, sql):
		start = time.time()
		cached = self.cache.get(sql)
		if(cached is not None):	
			queryResponse = cached
			app.logger.info("cached")
		else:
			queryData = {'query': sql}
			queryRequest = self.service.jobs.insert()
			queryResponse = queryRequest.query(projectId=self.api.projectId, body=queryData).execute() 
			self.cache.put(sql, queryResponse, 9000) #Cache query response for 15 mins
		app.logger.info('Query Time %f' % (time.time() - start))
		return queryResponse

	def query(self,bq_query,uid):
		storage = StorageByKeyName(CredentialsModel, uid, 'credentials')
		credentials = storage.get()
		api = APIAuthenticator(credentials, project_id)
		self.validate_user(api)
		query_response = self.run_in_big_query(bq_query)
		return query_response

	def validate_user(self,api):
		if isinstance(api, APIAuthenticator):
			self.api = api
			self.authenticateService()
			self.cache = cache.Cache()
		else:
			raise Exception("The API error")
