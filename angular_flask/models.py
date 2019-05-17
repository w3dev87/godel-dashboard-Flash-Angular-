import os
import sys
import datetime, time
import re, json
from collections import defaultdict
from angular_flask.client.influx import connect
from google.appengine.ext import db
from google.appengine.ext import ndb
import uuid, unicodedata
import requests
# from users import getTimeformat
from angular_flask import app
from angular_flask import api, IS_DEV_APPSERVER, APP_ENV
from angular_flask.hosting.services import auth, query, cache, users, customquery, scheduler, email
# from core import getInterface
from flask import Flask, request
from flask.ext.restful import abort
from flask.ext import restful
from flask.ext.restful import marshal_with, reqparse, Api, Resource, abort
from datetime import date
import datetime
from data import bank_to_pi, preffered_merchants, app_name_map, pg_name_map, merchant_dummyfy, funnel_type, to_str_columns
from util import frcheck, do_filtered, squeeze, get_app_name, alert_for_anomalies, run_reports, group_it
from util import alert_for_anomalies_coverage, createAlert, convert2datatype, get_date_range, bank_icon_list
from util import correct_recipient_format, check_date_length, alert_for_anomalies_pagemod, is_segment_valid
from util import in_utc, prev_date, is_same_day, map_app


def str_of_col(col_name):
	if col_name in to_str_columns:
		return "STRING(" + col_name + ")"
	return col_name

def gen_replace(replace_col, map_dict):
	for i in map_dict:
		for x in i:
			if x != i[0]:
				replace_col = '''replace({rep}, '{x}', '{i}')'''.format(x=x, rep=replace_col, i=i[0])
	return replace_col



def map_back_merchant(merchant):
	for i in merchant_dummyfy:
		if i[0] == merchant:
			return i[1]
	return merchant


def execute_query(sql_query, query_type, user_id, is_realtime=None):
	return query.execute(sql_query, query_type, user_id, is_realtime)

def is_juspay(user_id):
	return users.getRole(user_id) in ['Super', 'Admin', 'Juspay']

def is_client(user_id):
	return users.getRole(user_id) in ['Client']

def is_bank(user_id):
	return users.getRole(user_id) in ['Bank']

def is_pg(user_id):
	return users.getRole(user_id) in ['Pg']

def check_for_all(app_name, user_id):
	if app_name == 'All':
		if is_juspay(user_id):
			return ""
		else:
			app.logger.info("Security breach attempted: " + str((user_id, app_name)))
	if is_juspay(user_id) or is_client(user_id):
		return map_app(app_name)
	if is_bank(user_id):
		return 'merchant_id IN ' + str(preffered_merchants) + ' AND payment_instrument IN ' + str(bank_to_pi.get(app_name))+' AND'
	if is_pg(user_id):
		return 'merchant_id IN ' + str(preffered_merchants) + ' AND payment_gateway IN ' + str(pg_name_map.get(app_name))+' AND'

def streaming_rows(project_id, dataset_id, table_id, rows):
	return query.stream_it(project_id, dataset_id, table_id, rows)



class GetFilters(Resource):
	@auth._is_authorized
	def post(self, userid=None):
		params = request.get_json(force=True)
		if params.get("clientID") and params.get("from") and params.get("to"):
			app_name = get_app_name(userid, params.get("clientID"))
			app_name = check_for_all(app_name, userid)
			is_realtime = params.get('is_realtime')
			start = params.get("from")
			end = params.get("to")
			dimensions = params.get("dimensions")
			whr = params.get("where_clause") if params.get("where_clause") and is_juspay(userid)  else ""
			start, end, start_with_time, end_with_time = check_date_length(start, end, userid)
			filters = params.get('filters') if params.get('filters') else None

		else:
			return 'Request Format Error: clientID, start-time and end-time required'
		if len(dimensions) == 0:
			return {}
		dimensions_array =  ['merchant_payment_status', 'payment_gateway', 'aggregator', 'godel_version', 'os', 'merchant_id', \
				'authentication_status', 'app_version', 'is_internal_device', 'wallet', 'godel_remotes_version', \
				'payment_instrument_group', 'network', 'payment_status', 'payment_instrument', 'is_godel', 'weblab', \
				'experiments', 'log_level', 'auth_method', 'sim_operator']
		allowed_set = set(dimensions_array)
		dimensions = filter(lambda x: x in allowed_set, dimensions)
		if app_name is "":
			dimensions.append('app_name')
		# if is_pg(userid) and k == 'merchant_id':
		# 	app_name = "merchant_id IN ('fcbrowser', 'nspi') AND " + app_name
		bq_1 = 'select attr_name, key, value from '
		bq_2 = """
				(SELECT
				  '{dim1}' AS attr_name, 
				  {dim} AS key, 
				  EXACT_COUNT_DISTINCT(session_id) AS value
				FROM (TABLE_DATE_RANGE(godel_logs.godel_session, TIMESTAMP("{start}"), TIMESTAMP("{end}")))
				WHERE
				  {app_name} starttime >="{start_with_time}"
				  AND starttime<= "{end_with_time}" {where_clause}
				GROUP BY
				  key
				ORDER BY 
				  value DESC)"""
		bq_arr = []

		for k in dimensions:
			dim1 = k
			if frcheck(k):
				if (is_pg(userid) or is_bank(userid)) and k == 'merchant_id':
					#k = "(case when merchant_id == 'fcbrowser' then 'fcbrowser' when merchant_id== 'nspi'then 'nspi' else 'others' end)"
					k = gen_replace('merchant_id', merchant_dummyfy)
			bq_arr.append(bq_2.format(dim=k, dim1=dim1, where_clause=whr, app_name=app_name, start=start, end=end, \
						start_with_time=start_with_time, end_with_time=end_with_time))

		bq_2 = ', '.join(bq_arr)
		bq_arr = []
		bq_query = bq_1 + squeeze(bq_2)+ ';'
		return execute_query(squeeze(bq_query), 'filter', userid, is_realtime)

class CustomerList(Resource):
	def post(self, userid=None):

		h = request.headers
		if h['Authorization'] != "26t96yCjB08a8fybbF5ub7t69POHQOPR":
			abort(404)
		params = request.get_json(force=True)
		if params.get("conditions") and params.get("interval") and len(params.get("interval")) == 2:
			conditions = params.get("conditions")
			remoteVersion = "('" + "', '".join(conditions["remoteVersion"])+"')"
			interval = params.get("interval")
			start = time.strftime('%Y/%m/%d',  time.gmtime(int(interval[0])))
			end = time.strftime('%Y/%m/%d',  time.gmtime(int(interval[1])))
		else:
			return {'Request Format Error': 'conditions and interval required'}

		bq_query = """
				SELECT
				  app_name, 
				  client_id from(TABLE_DATE_RANGE(godel_logs.godel_session, TIMESTAMP("{start}"), TIMESTAMP("{end}")))
				WHERE
				  godel_remotes_version IN {remoteVersion}
				  AND SUBSTR(starttime, 1, 10) >="{start}"
				  AND SUBSTR(starttime, 1, 10) <= "{end}"
				GROUP BY
				  app_name, 
				  client_id;
			""".format(remoteVersion=remoteVersion, start=start, end=end)
		app.logger.info(bq_query)
		return execute_query(squeeze(bq_query), 'customer_list', userid)



class GetCounts(Resource):
	@auth._is_authorized
	def post(self, userid=None):
		params = request.get_json(force=True)
		if params.get("clientID") and params.get("from") and params.get("to"):
			app_name = get_app_name(userid, params.get("clientID"))
			app_name = check_for_all(app_name, userid)
			is_realtime = params.get('is_realtime', False)
			start = params.get("from")
			end = params.get("to")
			whr = params.get("where_clause") if params.get("where_clause") and is_juspay(userid) else ""
			start, end, start_with_time, end_with_time = check_date_length(start, end, userid)
			filters = params.get("filters") if params.get("filters") else None

		else:
			return "Request Format Error: clientID, start-time and end-time required"

		if is_same_day(end_with_time, start_with_time):

			if in_utc(userid):
				if is_realtime:
					timestamp = '''REPLACE((SUBSTR(starttime, 0, 16) + ':00'), '_', ' ')'''

				else:

					app.logger.info( 'in_utc in model '+str(userid))
					timestamp = '''CASE WHEN INTEGER(SUBSTR(starttime, 15, 2)) < 15
								   THEN((REPLACE((SUBSTR(starttime, 0, 13)), '_', ' '))+':00:00')
								   when (INTEGER(SUBSTR(starttime, 15, 2)) >= 15 and INTEGER(SUBSTR(starttime, 15, 2)) < 30 )
								   THEN((REPLACE((SUBSTR(starttime, 0, 13)), '_', ' '))+':15:00')
								   when (INTEGER(SUBSTR(starttime, 15, 2)) >= 30 and INTEGER(SUBSTR(starttime, 15, 2)) < 45 )
								   THEN((REPLACE((SUBSTR(starttime, 0, 13)), '_', ' '))+':30:00')
								   when (INTEGER(SUBSTR(starttime, 15, 2)) >= 45 and INTEGER(SUBSTR(starttime, 15, 2)) < 60 )
								   THEN((REPLACE((SUBSTR(starttime, 0, 13)), '_', ' '))+':45:00') END '''
			else:
				if is_realtime:
					timestamp = '''  REPLACE((SUBSTR(STRING(DATE_ADD(TIMESTAMP(REPLACE(starttime, '_', ' ')), 330, 'MINUTE')), 0, 16) + ':00'), '_', ' ') '''
				else:
					app.logger.info( 'in_ist in model '+str(userid))
					timestamp = '''CASE WHEN INTEGER(substr(string(date_add(TIMESTAMP(replace(starttime, '_', ' ')), 330, 'MINUTE')), 15, 2)) < 15
									THEN(substr(string(date_add(TIMESTAMP(replace(starttime, '_', ' ')), 330, 'MINUTE')), 0, 13)+':00:00')
									when (INTEGER(substr(string(date_add(TIMESTAMP(replace(starttime, '_', ' ')), 330, 'MINUTE')), 15, 2)) >= 15
										and INTEGER(substr(string(date_add(TIMESTAMP(replace(starttime, '_', ' ')), 330, 'MINUTE')), 15, 2)) < 30 )
									THEN(substr(string(date_add(TIMESTAMP(replace(starttime, '_', ' ')), 330, 'MINUTE')), 0, 13)+':15:00')
									when (INTEGER(substr(string(date_add(TIMESTAMP(replace(starttime, '_', ' ')), 330, 'MINUTE')), 15, 2)) >= 30
										and INTEGER(substr(string(date_add(TIMESTAMP(replace(starttime, '_', ' ')), 330, 'MINUTE')), 15, 2)) < 45 )
									THEN(substr(string(date_add(TIMESTAMP(replace(starttime, '_', ' ')), 330, 'MINUTE')), 0, 13)+':30:00')
									when (INTEGER(substr(string(date_add(TIMESTAMP(replace(starttime, '_', ' ')), 330, 'MINUTE')), 15, 2)) >= 45
										and INTEGER(substr(string(date_add(TIMESTAMP(replace(starttime, '_', ' ')), 330, 'MINUTE')), 15, 2)) < 60 )
									THEN(substr(string(date_add(TIMESTAMP(replace(starttime, '_', ' ')), 330, 'MINUTE')), 0, 13)+':45:00') END '''

		else:
			if in_utc(userid):
				app.logger.info( 'in_utc in model '+str(userid))
				timestamp = "((REPLACE((SUBSTR(starttime, 0, 13)), '_', ' '))+':00:00')"
			else:
				app.logger.info( 'in_ist in model '+str(userid))
				timestamp = "(substr(string(date_add(TIMESTAMP(replace(starttime, '_', ' ')), 330, 'MINUTE')), 0, 13)+':00:00')"

		lim = ""

		table_id = 'godel_logs.godel_session'
		if is_realtime:
			table_id = 'godel_logs.godel_realtime'
			start_with_time = (datetime.datetime.now() - datetime.timedelta(minutes=60)).strftime("%Y/%m/%d_%H:%M:%S")
			end_with_time = datetime.datetime.now().strftime("%Y/%m/%d_%H:%M:%S")
		bq_query = """
					SELECT
					  {timestamp} AS dt, 
					  INTEGER (COUNT(session_id)) AS session_cnt, 
					  SUM(CASE WHEN payment_status = "SUCCESS" THEN 1 ELSE 0 END) AS succ_cnt, 
					  SUM(CASE WHEN (payment_status = "FAILURE"
						  OR payment_status IS NULL) THEN 1 ELSE 0 END) AS fail_cnt, 
					  INTEGER(SUM(CASE WHEN payment_status == "SUCCESS" THEN 1 ELSE 0 END * 100)/INTEGER (EXACT_COUNT_DISTINCT(session_id))) AS succ_rate, 
					 INTEGER(SUM(CASE WHEN is_godel == "T" THEN 1 ELSE 0 END * 100)/INTEGER (EXACT_COUNT_DISTINCT(session_id))) AS is_godel, 
					  NTH(501, QUANTILES(otp_latency/1000, 1001)) AS otp_lat, 
					  NTH(501, QUANTILES(latency/1000, 1001)) AS sess_lat, 
					FROM (TABLE_DATE_RANGE({table_id}, TIMESTAMP("{start}"), TIMESTAMP("{end}")))
					WHERE
					  {app_name} starttime >= "{start_with_time}"
					  AND starttime <= "{end_with_time}"
					  AND timestamp(replace (starttime, "_", " ")) <= current_timestamp(){where_clause} {lim}
					GROUP BY
					  dt
					ORDER BY
					  dt
					""".format(app_name=app_name, where_clause=whr, start=start, end=end, timestamp=timestamp, lim=lim, \
							start_with_time=start_with_time, end_with_time=end_with_time, table_id=table_id)

		return execute_query(do_filtered(squeeze(bq_query), filters, userid), 'sess_count', userid, is_realtime)



class GetSegments(Resource):
	@auth._is_authorized
	def post(self, userid=None):
		params = request.get_json(force=True)
		is_realtime = params.get('is_realtime', False)
		dimensions =  ['payment_instrument', 'payment_instrument_group', 'godel_version', 'merchant_id', 'network', 'app_version', 'payment_processor', 'comparison']
		null_filter = ''
		if params.get("clientID") and params.get("from") and params.get("to"):
			app_name = get_app_name(userid, params.get("clientID"))
			app_name = check_for_all(app_name, userid)
			start = params.get("from")
			end = params.get("to")
			start, end, start_with_time, end_with_time = check_date_length(start, end, userid)
			dimension = is_segment_valid(params.get("dimension"), userid)
			if dimension == 'null':
				return {}, 400
			whr = params.get("where_clause") if params.get("where_clause") and is_juspay(userid) else ""
			dim3 = dimension
			dim4 = dimension.split(',')
			# dim5 = "case when " + dim4[0] + " is null then 'unknown' else " + dim4[0] + " end as " + dim4[0]
			dim5 = ""
			for cnt in range(0, len(dim4)):
				dim4_col_name = str_of_col(dim4[cnt])
				if is_pg(userid) and dim4[cnt] == 'merchant_id':
					# dim5 += 'ROW_NUMBER() OVER() AS merchant_id, '
					dim5 += "case when " + dim4[cnt] + " is null then 'unknown' else " + dim4[cnt] + " end as " + dim4[cnt] + ", "

				else:
					dim5 += "case when " + dim4_col_name + " is null then 'unknown' else " + dim4_col_name + " end as " + dim4[cnt] + ", "
			if app_name is "":
				dimensions.append('app_name')

			dim2 = "concat(" + dimension.split(',')[0]
			if(', ' in dimension):
				parts = dimension.split(',')
				dimension = "concat(" + parts[0]
				parts = parts[1:]
				for part in parts:
					dimension += ", " + part
					dim2 += ", " + "', '" + ", " + part
				dimension += ")"
			else:
				dim2 += ', ' + '\'\''
			dim2 += ")"
			if dimension not in dimensions:
				dimensions.append(dimension)
			dim6 = str_of_col(dimension)
			dim7 = dim3
			if dimension == 'payment_processor':
				dim6 = 'coalesce(wallet, aggregator, payment_gateway)'
				dim7 = 'coalesce(wallet, aggregator, payment_gateway) as payment_processor'
			if dimension == 'payment_instrument':
				dim6 = '''(case when coalesce(payment_instrument, bank, wallet) is not null then coalesce(payment_instrument, bank, wallet)
							else (case when (dropout_reasons='BEFORE_BANK' or dropout_reasons='NET_ERR') then 'BEFORE_BANK' else
							coalesce(payment_instrument, bank, wallet) end) end)'''
				dim7 = '''(case when coalesce(payment_instrument, bank, wallet) is not null then coalesce(payment_instrument, bank, wallet)
							else (case when (dropout_reasons='BEFORE_BANK' or dropout_reasons='NET_ERR') then 'BEFORE_BANK' else
							coalesce(payment_instrument, bank, wallet) end) end) as payment_instrument'''
			if dimension == 'payment_instrument_group':
				dim6 = '''(case when payment_instrument_group == 'unknown'
						   then (case when wallet is not null then 'wallet' end)
						   else payment_instrument_group end )'''
				dim7 = dim6 + ' as '+ dimension
			if is_pg(userid) and dimension == 'comparison':
				dim6 = '''(case when payment_instrument == 'HDFC' then 'ON_US' else 'OFF_US' end)
				'''
				dim7 = dim6 + ' as '+ dimension
			date_object_start = datetime.datetime.strptime(start, "%Y/%m/%d")
			date_object_end = datetime.datetime.strptime(end, "%Y/%m/%d")
			date7 = ((datetime.datetime.strptime(end_with_time, "%Y/%m/%d_%H:%M:%S")) - datetime.timedelta(days=7)).strftime("%Y/%m/%d_%H:%M:%S")
			date14 = ((datetime.datetime.strptime(end_with_time, "%Y/%m/%d_%H:%M:%S")) - datetime.timedelta(days=14)).strftime("%Y/%m/%d_%H:%M:%S")
			day14 = (date_object_end - datetime.timedelta(days=15)).strftime("%Y/%m/%d")
			filters = params.get('filters') if params.get('filters') else None
			if in_utc(userid):
				st = 'SUBSTR(starttime, 1, 10)'
			else:
				st = "substr(string(date_add(timestamp(REGEXP_REPLACE(starttime, '_', ' ')), 330, 'MINUTE')), 0, 10)"
		else:
			return 'Request Format Error: clientID, start-time and end-time required'
		if len(dimension) == 0:
			return {}
		allowed_set = set(dimensions)
		dimension = dimension if dimension in allowed_set else 'null'
		# if is_bank(userid):
		# 	# null_filter = dimension+' IS NOT NULL AND '
		# 	dim2 = dim2.replace("merchant_id", "concat('merchant_', string(length(merchant_id)))")
		# if is_pg(userid):
		# 	dim2 = dim2.replace("merchant_id", "concat('merchant_', string(merchant_id))")

		# 	# null_filter = dimension+' IS NOT NULL AND '
		# 	if dimension == 'merchant_id':
		# 		dim5 = 'ROW_NUMBER() OVER() AS merchant_id, '
		if is_realtime:
			table_id = 'godel_logs.godel_realtime'
			start_with_time = (datetime.datetime.now() - datetime.timedelta(minutes=60)).strftime("%Y/%m/%d_%H:%M:%S")
			end_with_time = datetime.datetime.now().strftime("%Y/%m/%d_%H:%M:%S")
		query_str = """
					SELECT
					  attr_n0, 
					  {dim2} AS value, 
					  t_count, 
					  latency_tp50, 
					  is_godel, 
					  auth_y, 
					  pay_s, 
					  pay_f, 
					  pay_u, 
					  mpay_s, 
					  mpay_f, 
					  mpay_u, 
					  dropout_res, 
					  data7, 
					  t_count7, 
					  pay_s7, 
					  data14, 
					  t_count14, 
					  pay_s14, 
					  sess_count
					FROM (
					  SELECT
						'{dim}' AS attr_n0, 
						{dim5}
						A.value AS value, 
						t_count, 
						is_godel, 
						auth_y, 
						pay_s, 
						pay_f, 
						pay_u, 
						mpay_s, 
						mpay_f, 
						mpay_u, 
						dropout_res, 
						C.data7 AS data7, 
						C.t_count7 AS t_count7, 
						C.pay_s7 AS pay_s7, 
						C.data14 AS data14, 
						C.t_count14 AS t_count14, 
						C.pay_s14 AS pay_s14, 
						D.sess_count, 
						E.latency_tp50 AS latency_tp50, 
						ROW_NUMBER() OVER() AS int_var
					  FROM (
						SELECT
						  (CASE WHEN {dim6} IS NULL THEN ' NULL' ELSE {dim6} END) AS value, 
						  {dim7}, 
						  EXACT_COUNT_DISTINCT(session_id) AS t_count, 
						  SUM(CASE WHEN is_godel = 'T' THEN 1 ELSE 0 END) AS is_godel, 
						  SUM(CASE WHEN authentication_status = 'Y' THEN 1 ELSE 0 END) AS auth_y, 
						  SUM(CASE WHEN payment_status = 'SUCCESS' THEN 1 ELSE 0 END) AS pay_s, 
						  SUM(CASE WHEN payment_status = 'FAILURE' THEN 1 ELSE 0 END) AS pay_f, 
						  SUM(CASE WHEN merchant_payment_status = 'SUCCESS' THEN 1 ELSE 0 END) AS mpay_s, 
						  SUM(CASE WHEN merchant_payment_status = 'FAILURE' THEN 1 ELSE 0 END) AS mpay_f, 
						  SUM(CASE WHEN payment_status IS NULL THEN 1 ELSE 0 END) AS pay_u, 
						  SUM(CASE WHEN merchant_payment_status IS NULL THEN 1 ELSE 0 END) AS mpay_u
						FROM (TABLE_DATE_RANGE(godel_logs.godel_session, TIMESTAMP("{start}"), TIMESTAMP("{end}")))
						WHERE
						  {null_filter}
						  {app_name} starttime >= "{start_with_time}"
						  AND starttime <= "{end_with_time}" {where_clause}
						GROUP BY
						  value, 
						  {dim3}) AS A
					  LEFT OUTER JOIN EACH (
						SELECT
						  (CASE WHEN val IS NULL THEN ' NULL' ELSE val END) AS value, 
						  GROUP_CONCAT(CASE WHEN dropout_reasons IS NULL THEN 'NULL' ELSE dropout_reasons END + "(" + STRING(cc) + ")") AS dropout_res
						FROM (
						  SELECT
							{dim6} AS val, 
							dropout_reasons, 
							EXACT_COUNT_DISTINCT(session_id) AS cc
						  FROM (TABLE_DATE_RANGE(godel_logs.godel_session, TIMESTAMP("{start}"), TIMESTAMP("{end}")))
						  WHERE
							{null_filter}
							{app_name} (payment_status <> 'SUCCESS'
							  OR payment_status IS NULL)
							AND starttime >= "{start_with_time}"
							AND starttime <= "{end_with_time}" {where_clause}
						  GROUP BY
							val, 
							dropout_reasons
						  ORDER BY
							cc DESC)
						GROUP BY
						  value) AS B
					  ON
						(A.value = B.value)
					  LEFT OUTER JOIN EACH (
						SELECT
						  value, 
						  GROUP_CONCAT(STRING(pay_s7/t_count7*100)) AS data7, 
						  SUM(t_count7) AS t_count7, 
						  SUM(pay_s7) AS pay_s7, 
						  GROUP_CONCAT(STRING(pay_s14/t_count14*100)) AS data14, 
						  SUM(t_count14) AS t_count14, 
						  SUM(pay_s14) AS pay_s14
						FROM (
						  SELECT
							(CASE WHEN {dim6} IS NULL THEN ' NULL' ELSE {dim6} END) AS value, 
							SUM(CASE WHEN (payment_status = 'SUCCESS'
								AND starttime >= "{date7}"
								AND starttime <= "{end_with_time}") THEN 1 ELSE 0 END) AS pay_s7, 
							SUM(CASE WHEN (SUBSTR(starttime, 1, 10) >= "{date7}"
								AND starttime <= "{end_with_time}") THEN 1 ELSE 0 END) AS t_count7, 
							SUM(CASE WHEN (payment_status = 'SUCCESS'
								AND starttime >= "{date14}"
								AND starttime <= "{end_with_time}") THEN 1 ELSE 0 END) AS pay_s14, 
							SUM(CASE WHEN (SUBSTR(starttime, 1, 10) >= "{date14}"
								AND starttime <= "{end_with_time}") THEN 1 ELSE 0 END) AS t_count14, 
							{st} AS s
						  FROM (TABLE_DATE_RANGE(godel_logs.godel_session, TIMESTAMP("{day14}"), TIMESTAMP("{end}")))
						  WHERE
							{null_filter}
							{app_name} starttime >= "{date14}"
							AND starttime <= "{end_with_time}" {where_clause}
						  GROUP BY
							s, 
							value
						  ORDER BY
							s)
						GROUP BY
						  value ) AS C
					  ON
						(A.value = C.value)
					  CROSS JOIN (
						SELECT
						  EXACT_COUNT_DISTINCT(session_id) AS sess_count
						FROM (TABLE_DATE_RANGE(godel_logs.godel_session, TIMESTAMP("{start}"), TIMESTAMP("{end}")))
						WHERE
						  {null_filter}
						  {app_name} starttime >= "{start_with_time}"
						  AND starttime <= "{end_with_time}" {where_clause}) AS D
					  LEFT OUTER JOIN EACH (
						SELECT
						  value, 
						  FIRST(latency_tp50) AS latency_tp50
						FROM (
						  SELECT
							(CASE WHEN {dim6} IS NULL THEN ' NULL' ELSE {dim6} END) AS value, 
							PERCENTILE_DISC(0.50) OVER(PARTITION BY value ORDER BY latency ASC) AS latency_tp50
						  FROM (TABLE_DATE_RANGE(godel_logs.godel_session, TIMESTAMP("{start}"), TIMESTAMP("{end}")))
						  WHERE
							{null_filter}
							{app_name} starttime >= "{start_with_time}"
							AND starttime <= "{end_with_time}" {where_clause})
						GROUP BY
						  value) AS E
					  ON
						(A.value = E.value)
					  ORDER BY
						value)
				""".format(dim=dimension, dim2=dim2, dim3=dim3, dim5=dim5, dim6=dim6, dim7=dim7, where_clause=whr, \
						app_name=app_name, start=start, end=end, date7=date7, date14=date14, day14=day14, st=st, \

						start_with_time=start_with_time, end_with_time=end_with_time, null_filter=null_filter)

		if (is_pg(userid) or is_bank(userid)) and 'merchant_id' in dim2:
			c_w = gen_replace('value', merchant_dummyfy)
			q2 = '''SELECT
					  attr_n0, 
					  {c_w} AS value, 
					  t_count, 
					  latency_tp50, 
					  is_godel, 
					  auth_y, 
					  pay_s, 
					  pay_f, 
					  pay_u, 
				      mpay_s, 
				      mpay_f, 
				      mpay_u, 
					  dropout_res, 
					  data7, 
					  t_count7, 
					  pay_s7, 
					  data14, 
					  t_count14, 
					  pay_s14, 
					  sess_count FROM ( {query_str} )'''.format(c_w=c_w, query_str=query_str)
	  		query_str = q2
		bq_query = do_filtered(squeeze(query_str), filters, userid) + ';'

		return execute_query(squeeze(bq_query), 'segment', userid, is_realtime)

# this function removes duplicates within a path.
# consider a path a-> a-> b -> b-> c
# this function will return the path as a -> b -> c
def removeDuplicates(path):
	if path == "" or path == None:
		return path
	path = [ str(i) for i in path.split(",") ]
	i = 0
	s = ""
	l = len(path)
	while i < l:
		t = path[i]
		j = path[::-1].index(t)
		j = l-j-1
		if j != i:
			i = j
		s += t + ", "
		i += 1
	return s[:-1]


def dropoutReason(drs, count):
	reasons = drs.split(",")
	if count ==[]:
		count = {}
	else:
		c = {}
		for i in count:
			c[str(i[0])] = i[1]
		count = c
	for i in reasons:
		count[str(i)]=count.get(str(i), 0)+1
	c = sorted(count.items(), key = lambda x: x[1], reverse=True)
	l = len(c)
	obj = []
	for i in range(l):
		obj.append([c[i][0], c[i][1]])
	return obj

# this function does 3 things-
# 1 . calls removeDuplicates to remove intermediate cycles
# 2. makes a list of edges , each with a source, target and value
# 3. formats the data in the required format for a sankey
def prepareData(res, diff):
	mat = []
	x = {}
	for i in res.keys():
		for j in res[i]:
			temp = j.get('drs')
			if temp == None:
				temp = ""
			if not j.get("fullpath"):
				continue
			p = removeDuplicates(str(j.get("fullpath")))
			if p == None:
				continue
			a, b = x.get(p, (0, ""))
			if b!="":
				b=b+", "
			x[p] = (a + float(i), b+temp)
	y = sorted(x.items(), key = lambda x: x[1][0], reverse=True)
	nodes = set()
	nodes.add("Start")
	edges = {}
	dropout_reason = {}
	yl = min(len(y), 30)
	for i in y[:yl]:
		if i[0] == None:
			continue
		path = i[0].split(",")
		count = i[1][0]
		l = len(path)
		if path[-1] != "SUCCESS":
			dropout_reason[str(path[-2])] = dropoutReason(i[1][1], dropout_reason.get(str(path[-2]), []))
		for j in range(l):
			nodes.add(path[j])
			if j == 0:
				edges[("START", str(path[j]))] = edges.get(("START", str(path[j])), 0)+ count
			if j < (l-1):
				edges[(str(path[j]), str(path[j+1]))] = edges.get((str(path[j]), str(path[j+1])), 0)+ count
	edge_list = []


	for i in dropout_reason.keys():
		dropout_reason[i] = dropout_reason[i][:5]

	#remove edge without target
	for i, j in edges.keys():
		if len(j.strip()) > 0: 
			x={}
			x["source"] = i
			x["target"] = j
			x["value"] = edges[(i, j)]
			if x.get("target", "null") == "FAILURE":
				x["drs"] = dropout_reason.get(i, [])
			else:
				x["drs"] = ""
			edge_list.append(x)
	edge_list = list(sorted(edge_list, key = lambda x: x.get("value"), reverse=True))
	return "".join(str(edge_list).split())

# this is the main function that calls the conversion funnel query and returns the data to mainCtrl.js
class GetFunnelData(Resource):
	@auth._is_authorized

	def post(self, userid=None):
		params = request.get_json(force=True)
		if params.get("clientID") and params.get("from") and params.get("to") and params.get('pi'):
			app_name = get_app_name(userid, params.get("clientID"))
			app_name = check_for_all(app_name, userid)
			start = params.get("from")
			end = params.get("to")
			pi = params.get("pi")
			whr = params.get("where_clause") if params.get("where_clause") and is_juspay(userid) else ""
			start,  end, start_with_time, end_with_time = check_date_length(start, end, userid)
			filters = params.get("filters") if params.get("filters") else None
			is_realtime = params.get("is_realtime")

		else:
			return "Request Format Error: clientID, start-time and end-time and valid payment instrument required"
		if is_realtime:
			realtime_clause = "starttime >= '" + str(start_with_time) + "' AND "
		else:
			realtime_clause = ""
		if is_pg(userid):
			#pi = map_back_merchant(pi)
			fil = ""
			if pi == 'ON_US':
				fil = 'AND payment_instrument IN ' + str(pg_name_map.get(get_app_name(userid, params.get("clientID"))))
			elif pi == 'OFF_US':
				fil = 'AND payment_instrument NOT IN ' + str(pg_name_map.get(get_app_name(userid, params.get("clientID"))))

			bq_query = """
						SELECT
						  EXACT_COUNT_DISTINCT(session_id) AS count, 
						  (CASE WHEN path = 'dropped_before_bank, authentication_failure, FAILURE' THEN 'dropped_before_bank, FAILURE' WHEN path = 'dropped_before_bank, dropped_at_bank, FAILURE' THEN 'dropped_before_bank, FAILURE' ELSE path END) AS fullpath, 
						  GROUP_CONCAT(dr) AS drs
						FROM (
						  SELECT
							session_id, 
							CONCAT(CASE WHEN (payment_instrument IS NULL
								AND authentication_status IS NULL
								AND ps_ !='SUCCESS') THEN 'dropped_before_bank, ' ELSE 'bank_reached, ' END, CASE WHEN (authentication_status = 'Y'
								OR ps_ = 'SUCCESS') THEN 'authentication_success, ' WHEN authentication_status IN ('A', 
								'U', 
								'ERR', 
								'N') THEN 'authentication_failure, ' ELSE 'dropped_at_bank, ' END, ps_ ) AS path, 
							dr_ AS dr
						  FROM (
							SELECT
							  session_id, 
							  authentication_status, 
							  payment_instrument, 
							  (CASE WHEN payment_status == 'SUCCESS' THEN 'SUCCESS' ELSE 'FAILURE' END) AS ps_, 
							  dropout_reasons AS dr_
							FROM
							  TABLE_DATE_RANGE([godel_logs.godel_session], TIMESTAMP("{start}"), TIMESTAMP("{end}"))
							WHERE
							  {app_name} {where_clause} {realtime_clause} payment_instrument_group <> 'netbanking' {fil}
							ORDER BY
							  session_id, 
							  ) )
						GROUP BY
						  fullpath
						ORDER BY
						  count DESC
			""".format(app_name=app_name, fil=fil, start=start, end=end, where_clause=whr, realtime_clause = realtime_clause)
		elif ( app_name.find("FreeCharge") != -1 and pi == "AXISUPI" ):
			#this check is for axis_upi
			#Todo: make this generic shouldn't need a complete different query
			bq_query = """SELECT
						  COUNT(*) AS count, 
						  CONCAT(path, ', ', payment_) AS fullpath, 
						  GROUP_CONCAT(dr) AS drs
						FROM (
						  SELECT
						    session_id, 
						    GROUP_CONCAT(ap_url) AS path, 
						    LAST(ps_) AS payment_, 
						    LAST(dr_) AS dr
						  FROM (
						    SELECT
						      session_id, 
						      UPPER(api_requests.shortcode) as ap_url, 
						      (CASE WHEN payment_status == 'SUCCESS' THEN 'SUCCESS' ELSE 'FAILURE' END) AS ps_, 
						      dropout_reasons AS dr_
						     FROM
						      TABLE_DATE_RANGE([godel_logs.godel_session], TIMESTAMP("{start}"), TIMESTAMP("{end}"))
						    WHERE
						      plugin = "axis_upi"
						      AND {realtime_clause} app_name='FreeCharge'
						    ORDER BY
						      session_id, 
						      api_requests.starttime )
						  GROUP BY
						    session_id )
						GROUP BY
						  fullpath
						ORDER BY
						  count DESC
			""".format(app_name=app_name, pi=pi, start=start, end=end, where_clause=whr, realtime_clause = realtime_clause)
		else:
			bq_query = """
						SELECT
						  COUNT(*) AS count, 
						  (CASE WHEN authentication_status = 'Y'
							AND payment_instrument_group <> 'netbanking' THEN CONCAT(path, ', ', 'AUTHENTICATION_SUCCESS, ', payment_) ELSE CONCAT(path, ', ', payment_) END ) AS fullpath, 
						  GROUP_CONCAT(dr) AS drs
						FROM (
						  SELECT
							session_id, 
							GROUP_CONCAT(events.value) AS path, 
							authentication_status, 
							payment_instrument_group, 
							LAST(ps_) AS payment_, 
							LAST(dr_) AS dr
						  FROM (
							SELECT
							  session_id, 
							  events.value, 
							  authentication_status, 
							  payment_instrument_group, 
							  (CASE WHEN payment_status == 'SUCCESS' THEN 'SUCCESS' ELSE 'FAILURE' END) AS ps_, 
							  dropout_reasons AS dr_
							FROM
							  TABLE_DATE_RANGE([godel_logs.godel_session], TIMESTAMP("{start}"), TIMESTAMP("{end}"))
							WHERE
							  (weblab='ON'
								OR weblab='T')
							  AND is_godel='T'
							  AND {app_name} {realtime_clause} payment_instrument="{pi}"
							  AND events.label = 'pageStatus' {where_clause}
							ORDER BY
							  session_id, 
							  events.starttime)
						  GROUP BY
							session_id, 
							authentication_status, 
							payment_instrument_group )
						GROUP BY
						  fullpath
						ORDER BY
						  count DESC
			""".format(app_name=app_name, pi=pi, start=start, end=end, where_clause=whr, realtime_clause = realtime_clause)
		bq_query = do_filtered(squeeze(bq_query), filters, userid)
		res = execute_query(squeeze(bq_query), 'getting_pi', userid, is_realtime)
		res = json.loads(res.get_data())
		diff = (datetime.datetime.strptime(end, "%Y/%m/%d").date() - datetime.datetime.strptime(start, "%Y/%m/%d").date()).days + 1
		return prepareData(res, diff)

# this gets all valid payment instruments for a particular merchant
class GetFunnels(Resource):
	@auth._is_authorized

	def post(self, userid=None):
		params = request.get_json(force=True)
		if params.get("clientID") and params.get("from") and params.get("to"):
			app_name = get_app_name(userid, params.get("clientID"))
			app_name = check_for_all(app_name, userid)
			start = params.get("from")
			end = params.get("to")
			whr = params.get("where_clause") if params.get("where_clause") and is_juspay(userid) else ""
			start, end, start_with_time, end_with_time = check_date_length(start, end, userid)
			filters = params.get("filters") if params.get("filters") else None
			is_realtime = params.get("is_realtime")
		else:
			return "Request Format Error: clientID, start-time and end-time required"
		if is_realtime:
			realtime_clause = "starttime >= '" + str(start_with_time) + "' AND "
		else:
			realtime_clause = ""
		
		# this is to get all pi's for the particular merchant_app
		if is_pg(userid):
			return funnel_type

		else:
			query_for_pi = """
					SELECT
					  (payment_instrument) AS pi, 
					  COUNT(*) AS co
					FROM
					  TABLE_DATE_RANGE([godel_logs.godel_session], TIMESTAMP("{start}"), TIMESTAMP("{end}"))
					WHERE
					  (weblab='ON'
						OR weblab='T') {where_clause}
					  AND is_godel='T'
					  AND {app_name} {realtime_clause} payment_instrument!="null"
					GROUP BY
					  pi
					ORDER BY
					  co DESC
  		""".format(app_name=app_name, start = start, end=end, where_clause=whr, realtime_clause= realtime_clause)

		query_for_pi = do_filtered(squeeze(query_for_pi), filters, userid)
		all_pi = execute_query(squeeze(query_for_pi), 'getting_pi', userid, is_realtime)
		all_pi = json.loads(all_pi.get_data())
		temp = []
		for i in all_pi.keys():
			temp.append((i, all_pi[i][0]["co"]))
		temp = sorted(temp, key=lambda x: x[1], reverse=True)
		t = []
		for i in temp: t.append(str(i[0]))
		return t

class GetSessions(Resource):
	@auth._is_authorized
	def post(self, userid=None):
		params = request.get_json(force=True)
		if params.get("clientID") and params.get("from") and params.get("to"):
			app_name = get_app_name(userid, params.get("clientID"))
			app_name = check_for_all(app_name, userid)
			start = params.get("from")
			end = params.get("to")
			whr = params.get("where_clause") if params.get("where_clause") and is_juspay(userid) else ""
			start, end, start_with_time, end_with_time = check_date_length(start, end, userid)
			filters = params.get("filters") if params.get("filters") else None
		else:
			return "Request Format Error: clientID, start-time and end-time required"
		if in_utc(userid):
			stime='starttime'
		else:
			stime = "substr(string(date_add(timestamp(REGEXP_REPLACE(starttime, '_', ' ')), 330, 'MINUTE')), 0, 19)"
		bq_1 = """
					SELECT
					  session_id, 
					  session_id AS sid, 
					  device_id AS d_id, 
					  dropout_reasons, 
					  authentication_status as zauth_status,
					  transaction_id AS txn_id, 
					  order_id, 
					  payment_status AS pstat, 
					  network AS net, 
					  latency AS avglat, 
					  numpages AS nump, 
					  auth_method AS auth, 
					  {stime} AS stime, 
					  is_godel AS godel, 
					  last_visited_url AS lurl, 
					  card_brand AS cbrand, 
					  customer_email AS email, 
					  customer_phone_number AS phone
					FROM (TABLE_DATE_RANGE(godel_logs.godel_session, TIMESTAMP("{start}"), TIMESTAMP("{end}")))
					WHERE
					  {app_name} starttime >= "{start_with_time}"
					  AND starttime <= "{end_with_time}" {where_clause};
				""".format(app_name=app_name, start=start, end=end, where_clause=whr, stime=stime, \
						start_with_time=start_with_time, end_with_time=end_with_time)
		bq_query=do_filtered(squeeze(bq_1), filters, userid).replace('payment_processor', 'coalesce (wallet, aggregator, payment_gateway)')
		return execute_query(bq_query, "session", userid)

class DownloadSessions(Resource):
	@auth._is_authorized
	def post(self, userid=None):
		params = request.get_json(force=True)
		if params.get("clientID") and params.get("from") and params.get("to") and params.get("tab"):
			app_name = get_app_name(userid, params.get("clientID"))
			app_name = check_for_all(app_name, userid)
			start = params.get("from")
			end = params.get("to")
			tab = params.get("tab")
			whr = params.get("where_clause") if params.get("where_clause") and is_juspay(userid) else ""
			start, end, start_with_time, end_with_time = check_date_length(start, end, userid)
			filters = params.get("filters") if params.get("filters") else None


		else:
			return "Request Format Error: clientID, start-time and end-time required"

		if in_utc(userid):
			stime='starttime'
		else:
			stime = "substr(string(date_add(timestamp(REGEXP_REPLACE(starttime, '_', ' ')), 330, 'MINUTE')), 0, 19)"
		bq_query = """
					SELECT
					  session_id, 
					  {tab}, 
					  session_id AS sid, 
					  transaction_id AS txn_id, 
					  order_id, 
					  payment_status AS pstat, 
					  network AS net, 
					  latency AS avglat, 
					  auth_method AS auth, 
					  {stime} AS stime, 
					  is_godel AS godel, 
					  card_brand AS cbrand, 
					  authentication_status AS auth_stat, 
					  dropout_reasons, 
					  customer_email AS email, 
					  customer_phone_number AS phone
					FROM (TABLE_DATE_RANGE(godel_logs.godel_session, TIMESTAMP("{start}"), TIMESTAMP("{end}")))
					WHERE
					  {app_name} starttime >= "{start_with_time}"
					  AND starttime <= "{end_with_time}" {where_clause};
				""".format(app_name=app_name, start=start, end=end, tab=tab, where_clause=whr, \
						start_with_time=start_with_time, end_with_time=end_with_time, stime=stime)
		return execute_query(do_filtered(squeeze(bq_query), filters, userid), "session", userid)

class GetSegmentMetric(Resource):
	@auth._is_authorized
	def post(self, userid=None):
		params = request.get_json(force=True)
		if params.get("clientID") and params.get("from") and params.get("to"):
			app_name = get_app_name(userid, params.get("clientID"))
			app_name = check_for_all(app_name, userid)
			start = params.get("from")
			end = params.get("to")
			whr = params.get("where_clause") if params.get("where_clause") and is_juspay(userid) else ""
			filters = params.get("filters") if params.get("filters") else None
			start, end, start_with_time, end_with_time = check_date_length(start, end, userid)


		else:
			return "Request Format Error: clientID, start-time and end-time required"
		bq_query = """
					SELECT
					  all, 
					  session, 
					  succpay, 
					  authpay, 
					  x
					FROM (
					  SELECT
						'AllData' AS all, 
						INTEGER(EXACT_COUNT_DISTINCT(session_id)) AS session, 
						SUM(CASE WHEN payment_status = "SUCCESS" THEN 1 ELSE 0 END) AS succpay, 
						SUM(CASE WHEN (authentication_status="Y") THEN 1 ELSE 0 END) AS authpay, 
						TIMESTAMP_TO_MSEC(TIMESTAMP(SUBSTR(starttime, 1, 10))) AS x
					  FROM (TABLE_DATE_RANGE(godel_logs.godel_session, TIMESTAMP("{start}"), TIMESTAMP("{end}")))
					  WHERE
						{app_name} starttime >= "{start_with_time}"
						AND starttime <= "{end_with_time}" {where_clause}
					  GROUP BY
						x
					  ORDER BY
						x);""".format(app_name=app_name, start=start, end=end, where_clause=whr, \
							start_with_time=start_with_time, end_with_time=end_with_time)
		return execute_query(do_filtered(squeeze(bq_query), filters, userid), 'seg_count', userid)

class GetDropoutReasons(Resource):
	@auth._is_authorized
	def post(self, userid=None):
		params = request.get_json(force=True)
		if params.get("clientID") and params.get("from") and params.get("to"):
			app_name = get_app_name(userid, params.get("clientID"))
			app_name = check_for_all(app_name, userid)
			start = params.get("from")
			end = params.get("to")
			whr = params.get("where_clause") if params.get("where_clause") and is_juspay(userid) else ""
			start, end, start_with_time, end_with_time = check_date_length(start, end, userid)
			filters = params.get("filters") if params.get("filters") else None


		else:
			return "Request Format Error: clientID, start-time and end-time required"
		bq_query = """
				 SELECT
				   'AllData' AS all, 
				   dropout_reasons AS reason, 
				   EXACT_COUNT_DISTINCT(session_id) AS count, 
				   TIMESTAMP_TO_MSEC(TIMESTAMP(SUBSTR(starttime, 1, 10))) AS x
				 FROM (TABLE_DATE_RANGE(godel_logs.godel_session, TIMESTAMP("{start}"), TIMESTAMP("{end}")))
				 WHERE
				   (payment_status <> 'SUCCESS'
					 OR payment_status IS NULL)
				   AND {app_name} starttime >= "{start_with_time}"
				   AND starttime <= "{end_with_time}" {where_clause}
				 GROUP BY
				   reason, 
				   x
				 ORDER BY
				   x DESC;""".format(app_name=app_name, start=start, end=end, where_clause=whr, \
				 		start_with_time=start_with_time, end_with_time=end_with_time)
		fil_query = do_filtered(squeeze(bq_query), filters, userid).replace('''dropout_reasons="BEFORE_BANK"''', \
		 '''dropout_reasons in ('BEFORE_BANK', 'NET_ERR') AND payment_instrument is null ''')
		return execute_query(fil_query, 'dropout', userid)

class GetClients(Resource):
	@auth._is_authorized
	def post(self, userid=None):
		params = request.get_json(force=True)
		if users.getAppname(userid) == "Juspay":
			is_realtime = params.get('is_realtime')
			start = params.get("from").split('_')[0]
			end = params.get("to").split('_')[0]
			client = gen_replace('app_name', app_name_map)
			bq_query="""
					SELECT
					  'client_id' AS cid, 
					  {client} AS an, COUNT(*) as cnt
					FROM (TABLE_DATE_RANGE(godel_logs.godel_session, TIMESTAMP("{start}"), TIMESTAMP("{end}")))
					WHERE
					  app_name IS NOT NULL
					GROUP BY
					  an
					ORDER BY
					  cnt desc, an asc;
					  """.format(end=end, start=start, client=client)

			return execute_query(squeeze(bq_query), 'client', userid, is_realtime)
		else:
			return {"client_id": [users.getAppname(userid)]}

class GetPrefs(Resource):
	@auth._is_authorized
	def post(self, userid=None):
		params = request.get_json(force=True)
		email = params.get("email")
		email = email[1:len(email)-1]
		if users.is_super_user(email) == True:
			users.addUser(email, "Super")
		data = users.getPrefs(email, "where")
		return data

class StorePrefs(Resource):
	@auth._is_authorized
	def post(self, userid=None):
		data={"result":""}
		params = request.get_json(force=True)
		email = params.get("email")
		email = email[1:len(email)-1]
		where = params.get("string")
		data = users.storePrefs(email, "where", where)
		return data

class AddUser(Resource):
	@auth._is_authorized
	def post(self, userid=None):
		data={"result":"", "appname":""}
		params = request.get_json(force=True)
		email = params.get("email")
		role = params.get("role")
		appname = params.get("appname", None)
		data["appname"] = users.generate_appname(email)
		if(email in users.super_user or role == "Super"):
			data["result"] = "false"
			return data
		result = users.addUser(email, role, appname)
		data["result"] = result
		return data

class EditUser(Resource):
	@auth._is_authorized
	def post(self, userid=None):
		data={"result":"", "appname":"", "role":"", "timeformat":""}
		params = request.get_json(force=True)
		email = params.get("email")
		edit_role = params.get("role")
		edit_appname = params.get("appname")
		edit_timeformat = params.get("timeformat")

		if(email == userid):
			edit_role = ""

		if (email in users.super_user or edit_role == "Super"):
			data["result"] = "false"
		if not users.keyExists(email):
			data["result"] = "true"
			return data

		if(edit_appname==""):
			appname=users.getAppname(email)
		else:
			appname=edit_appname

		if(edit_timeformat==""):
			timeformat= users.getTimeformat(email)
		else:
			timeformat=edit_timeformat

		if(edit_role==""):
			role=users.getRole(email)
		else:
			role=edit_role

		data["appname"] = appname
		data["timeformat"] =  timeformat
		data["role"] = role
		result = users.editUser(email, role, appname, timeformat)
		data["result"] = result
		return data

class UpdateUser(Resource):
	@auth._is_authorized
	def post(self, userid=None):
		params = request.get_json(force=True)
		delList = params.get("delList")
		if (delList != None):
			if users.getRole(userid) == "Super":
				pass
			else:
				temp = []
				for itr in delList:
					if users.getRole(itr) == "Super" or itr == userid:
						pass
					else:
						temp.append(itr);
				delList = temp;
			for email in delList:
				users.delUser(email)
		row = users.getAllUsers()
		data = {"value":row, "list":delList, "role":users.getRole(userid), "email":userid}
		return data

class Navbar(Resource):
	@auth._is_authorized
	def post(self, userid=None):
		params = request.get_json(force=True)
		return users.getRole(userid)


class CustomQuery(Resource):
	@auth._is_authorized
	def post(self, userid=None):
		params = request.get_json(force=True)
		bq_query = params.get("query")
		key = params.get("key")
		data=execute_query(squeeze(bq_query), "custom_query", userid)
		if data != None:
			key = userid + "|" + key
			customquery.add(key, bq_query, userid);
		return data

class ExecQuery(Resource):
	@auth._is_authorized
	def post(self, userid=None):
		params = request.get_json(force=True)
		bq_query = params.get("query")
		return execute_query(squeeze(bq_query), "custom_query", userid)

class ExecPlaceholderQuery(Resource):
	@auth._is_authorized
	def post(self, userid=None):
		params = request.get_json(force=True)
		bq_query = get_date_range(params.get("query"))
		return execute_query(squeeze(bq_query), "custom_query", userid)

class UpdateQuery(Resource):
	@auth._is_authorized
	def post(self, userid=None):
		data = customquery.getAll(userid)
		return data

class DelQuery(Resource):
	@auth._is_authorized
	def post(self, userid=None):
		params = request.get_json(force=True)
		key = params.get("key")
		key = userid + "|" + key
		customquery.delQuery(key)
		return True

class Logout(Resource):
	@auth._is_authorized
	def post(self, userid=None):
		params = request.get_json(force=True)
		uuid = params.get("uuid")
		address_k = db.Key.from_path('CredentialsModel', uuid)
		key = db.get(address_k)
		db.delete(key)
		return

class SuccessRateAlerts(Resource):
	def get(self, userid=None):
		start = datetime.datetime.utcnow()
		clients = ["Freecharge", "redBus", "MakeMyTrip", "Cleartrip", "Snapdeal", "bookmyshow", \
			"MobiKwik", "Foodpanda"]
		for app_name in clients:
			bq_query = """
					SELECT
					  key, 
					  dt, 
					  pid, 
					  scount, 
					  auth, 
					  succ
					FROM (
					  SELECT
						"reports" AS key, 
						'1_day' AS dt, 
						payment_instrument AS pid, 
						EXACT_COUNT_DISTINCT(session_id) AS scount, 
						SUM(CASE WHEN authentication_status = "Y" THEN 1 ELSE 0 END) AS auth, 
						SUM(CASE WHEN payment_status = "SUCCESS" THEN 1 ELSE 0 END) AS succ
					  FROM (TABLE_DATE_RANGE(godel_logs.godel_session, TIMESTAMP("{date}"), TIMESTAMP("{date}")))
					  WHERE
						app_name = "{app_name}"
						AND is_godel = "T"
						AND SUBSTR(starttime, 1, 10) <= "{date}"
						AND payment_instrument_group <> "unknown"
					  GROUP BY
						pid, 
						dt), 
			""".format(app_name=app_name, date=start.strftime("%Y/%m/%d"))
			bq_query += ",".join(["""(SELECT "reports" as key, substr(starttime, 1, 10) as dt, 
				  payment_instrument AS pid, 
				  EXACT_COUNT_DISTINCT(session_id) AS scount, 
				  SUM(CASE WHEN authentication_status = "Y" THEN 1 ELSE 0 END) AS auth, 
				  SUM(CASE WHEN payment_status = "SUCCESS" THEN 1 ELSE 0 END) AS succ
				FROM (TABLE_DATE_RANGE(godel_logs.godel_session, TIMESTAMP("{date}"), TIMESTAMP("{date}")))
				WHERE
				  app_name = "{app_name}"
				  AND is_godel = "T"
				  AND SUBSTR(starttime, 1, 10) <= "{date}"
				  AND payment_instrument_group <> "unknown"
				GROUP BY
				  pid, 
				  dt)
			""".format(app_name=app_name, date=(start - datetime.timedelta(days=i)).strftime("%Y/%m/%d")) \
					for i in range(1, 31)])
			bq_query += """, (SELECT
				  "reports" AS key, 
				  "14_day" AS dt, 
				  payment_instrument AS pid, 
				  EXACT_COUNT_DISTINCT(session_id) AS scount, 
				  SUM(CASE WHEN authentication_status = "Y" THEN 1 ELSE 0 END) AS auth, 
				  SUM(CASE WHEN payment_status = "SUCCESS" THEN 1 ELSE 0 END) AS succ
				FROM (TABLE_DATE_RANGE(godel_logs.godel_session, TIMESTAMP("{start}"), TIMESTAMP("{end}")))
				WHERE
				  app_name = "{app_name}"
				  AND is_godel = "T"
				  AND SUBSTR(starttime, 1, 10) <= "{end}"
				  AND SUBSTR(starttime, 1, 10) >= "{start}"
				  AND payment_instrument_group <> "unknown"
				GROUP BY
				  pid, 
				  dt);
			""".format(app_name=app_name, start=(start - datetime.timedelta(days=14)).strftime("%Y/%m/%d"), \
			end=(start - datetime.timedelta(days=1)).strftime("%Y/%m/%d"))
			res = execute_query(squeeze(bq_query), "alert", "itadmin@juspay.in")

			alert_for_anomalies(res, app_name, start.strftime("%Y/%m/%d:%H:%M:%S"))
			return('done')


class ModifyPageAlerts(Resource):
	def get(self, userid=None):
		start = datetime.datetime.utcnow()
		end = start - datetime.timedelta(hours=24)
		bq_query = """
				SELECT
				  'pagemod' AS pagemod, 
				  payment_instrument AS pi, 
				  SUM(CASE WHEN (numscreens = 0
					  AND is_godel = "T") THEN 1 ELSE 0 END) AS zero_screens_godel_true, 
				  SUM(CASE WHEN (is_godel= "T") THEN 1 ELSE 0 END) AS godel_true, 
				  SUM(CASE WHEN ((godel_version CONTAINS "0.5rc" OR godel_version CONTAINS "0.6rc")
					  AND events.label CONTAINS "modify_page_error") THEN 1 ELSE 0 END) AS modify_page_errors, 
				  EXACT_COUNT_DISTINCT(session_id) AS total_sessions, 
				  ROUND(SUM(CASE WHEN ((godel_version CONTAINS "0.5rc" OR godel_version CONTAINS "0.6rc")
						AND events.label CONTAINS "modify_page_error") THEN 1 ELSE 0 END) / SUM(CASE WHEN (is_godel= "T") THEN 1 ELSE 0 END) * 100, 2) AS rate
				FROM (TABLE_DATE_RANGE(godel_logs.godel_session, TIMESTAMP("{start}"), TIMESTAMP("{end}")))
				WHERE
				  starttime <= "{end}"
				  AND payment_instrument_group <> "unknown"
				GROUP BY
				  pi;
				  """.format(start=end.strftime("%Y/%m/%d"), end=start.strftime("%Y/%m/%d"))

		res = execute_query(squeeze(bq_query), "alert", "itadmin@juspay.in")['pagemod']
		alert = filter(lambda x: float(x.get('rate') if x.get('rate') else 0) >= 1.0, res)
		if len(alert) > 1:
			for i in range(len(alert)):
				if alert[i].get('pi'):
					query = """
							SELECT
							  'e_val' AS e_val, 
							  events.value AS e_value
							FROM (TABLE_DATE_RANGE(godel_logs.godel_session, TIMESTAMP("{start}"), TIMESTAMP("{end}")))
							WHERE
							  payment_instrument = "{pay_instr}"
							  AND starttime <= "{end}"
							  AND payment_instrument_group <> "unknown"
							  AND events.label = "modify_page_error"
							GROUP BY
							  e_value;
					""".format(start=end.strftime("%Y/%m/%d"), end=start.strftime("%Y/%m/%d"), pay_instr=alert[i].get('pi'))
					values = execute_query(squeeze(query), "alert", "itadmin@juspay.in")['e_val']
					if values:
						alert[i]['e_value'] = map(lambda x: x.get('e_value'), values)
		alert_for_anomalies_pagemod(alert)
		return('done')

class GodelCoverageAlerts(Resource):
	def get(self, userid=None):
		start = datetime.datetime.utcnow()
		end = start - datetime.timedelta(hours=24)
		dimensions = ['app_name', 'godel_version', 'payment_instrument']
		alert = []
		filter_list = {}
		filter_list['app_name'] = ["Freecharge", "redBus", "MakeMyTrip", "Cleartrip", "Snapdeal", "bookmyshow", \
				"MobiKwik", "Foodpanda"]
		q = """
			SELECT
			  {dim}
			FROM (TABLE_DATE_RANGE(godel_logs.godel_session, TIMESTAMP("{start}"), TIMESTAMP("{end}")))
			WHERE
			  payment_instrument_group <> 'unknown'
			GROUP BY
			  {dim};
			"""
		filter_list['payment_instrument'] = execute_query(squeeze(q.format(start=end.strftime("%Y/%m/%d"), \
			end=start.strftime("%Y/%m/%d"), dim='payment_instrument')), "alert", "itadmin@juspay.in").keys()
		filter_list['godel_version'] = execute_query(squeeze(q.format(start=end.strftime("%Y/%m/%d"), \
			end=start.strftime("%Y/%m/%d"), dim='godel_version')), "alert", "itadmin@juspay.in").keys()

		for dim in dimensions:
			query = """
				SELECT
				  'godel' AS godel, 
				  *, 
				  ROUND((godel_true/total_sessions)*100, 2) AS godel_coverage
				FROM (
				  SELECT
					{dim}, 
					SUM(CASE WHEN (numscreens = 0
						AND is_godel ="T") THEN 1 ELSE 0 END) AS zero_screens_godel_true, 
					SUM(CASE WHEN (is_godel= "T") THEN 1 ELSE 0 END) AS godel_true, 
					EXACT_COUNT_DISTINCT(session_id) AS total_sessions
				  FROM (TABLE_DATE_RANGE(godel_logs.godel_session, TIMESTAMP("{start}"), TIMESTAMP("{end}")))
				  GROUP BY
					{dim});
				"""
			bq_1 = query.format(start=end.strftime("%Y/%m/%d"), end=start.strftime("%Y/%m/%d"), dim=dim)
			res = execute_query(squeeze(bq_1), "alert", "itadmin@juspay.in")['godel']
			bq_2 = query.format(start=(start - datetime.timedelta(days=14)).strftime("%Y/%m/%d"), \
				end=start.strftime("%Y/%m/%d"), dim=dim)
			hist = execute_query(squeeze(bq_2), "alert", "itadmin@juspay.in")['godel']
			for i in res:
				ref = filter(lambda x: x.get(dim) == i.get(dim), hist)
				ref = ref[0] if len(ref) > 0 else []
				if i.get(dim) in filter_list.get(dim) and i.get(dim) != None and i.get('total_sessions') > 50:
					if i.get('godel_coverage') and ref.get('godel_coverage') and \
							i.get('godel_coverage') < ref.get('godel_coverage'):
						alert.append({'alert': i, 'hist': ref, 'type': dim})

		alert_for_anomalies_coverage(alert)
		return ('done')

class Reports(Resource):
	def get(self, userid=None):
		start = datetime.datetime.utcnow() - datetime.timedelta(days=2)
		clients = ["Freecharge", "redBus", "MakeMyTrip"]
		report = defaultdict(lambda : defaultdict(dict))

		for app_name in clients:
			bq_query = """
			SELECT
			  key, 
			  start_time, 
			  payment_instrument, 
			  session_count, 
			  ROUND(authentication_success/session_count * 100) AS auth_success, 
			  ROUND(payment_success/session_count * 100) AS pay_success
			FROM (
			  SELECT
				"reports" AS key, 
				SUBSTR(starttime, 1, 10) AS start_time, 
				payment_instrument, 
				EXACT_COUNT_DISTINCT(session_id) AS session_count, 
				SUM(CASE WHEN authentication_status = "Y" THEN 1 ELSE 0 END) AS authentication_success, 
				SUM(CASE WHEN payment_status = "SUCCESS" THEN 1 ELSE 0 END) AS payment_success
			  FROM (TABLE_DATE_RANGE(godel_logs.godel_session, TIMESTAMP("{date}"), TIMESTAMP("{date}")))
			  WHERE
				app_name = "{app_name}"
				AND is_godel = "T"
				AND SUBSTR(starttime, 1, 10) <= "{date}"
				AND payment_instrument_group <> "unknown"
			  GROUP BY
				payment_instrument, 
				start_time), """.format(app_name=app_name, date=start.strftime("%Y/%m/%d"))
			bq_query += """  (
					  SELECT
						"reports" AS key, 
						"7_day" AS start_time, 
						payment_instrument, 
						EXACT_COUNT_DISTINCT(session_id) AS session_count, 
						SUM(CASE WHEN authentication_status = "Y" THEN 1 ELSE 0 END) AS authentication_success, 
						SUM(CASE WHEN payment_status = "SUCCESS" THEN 1 ELSE 0 END) AS payment_success
					  FROM (TABLE_DATE_RANGE(godel_logs.godel_session, TIMESTAMP("{start}"), TIMESTAMP("{end}")))
					  WHERE
						app_name = "{app_name}"
						AND is_godel = "T"
						AND SUBSTR(starttime, 1, 10) <= "{end}"
						AND SUBSTR(starttime, 1, 10) >= "{start}"
						AND payment_instrument_group <> "unknown"
					  GROUP BY
						payment_instrument, 
						start_time)
			""".format(app_name=app_name, start=(start - datetime.timedelta(days=7)).strftime("%Y/%m/%d"), \
			end=(start - datetime.timedelta(days=1)).strftime("%Y/%m/%d"))
			bq_query += """, 
				  (SELECT
					"reports" AS key, 
					"14_day" AS start_time, 
					payment_instrument, 
					EXACT_COUNT_DISTINCT(session_id) AS session_count, 
					SUM(CASE WHEN authentication_status = "Y" THEN 1 ELSE 0 END) AS authentication_success, 
					SUM(CASE WHEN payment_status = "SUCCESS" THEN 1 ELSE 0 END) AS payment_success
				  FROM (TABLE_DATE_RANGE(godel_logs.godel_session, TIMESTAMP("{start}"), TIMESTAMP("{end}")))
				  WHERE
					app_name = "{app_name}"
					AND is_godel = "T"
					AND SUBSTR(starttime, 1, 10) <= "{end}"
					AND SUBSTR(starttime, 1, 10) >= "{start}"
					AND payment_instrument_group <> "unknown"
				  GROUP BY
					payment_instrument, 
					start_time)
				GROUP BY
				  key, 
				  start_time, 
				  payment_instrument, 
				  session_count, 
				  auth_success, 
				  pay_success
				ORDER BY
				  payment_instrument, 
				  pay_success;
			""".format(app_name=app_name, start=(start - datetime.timedelta(days=14)).strftime("%Y/%m/%d"), \
			end=(start - datetime.timedelta(days=1)).strftime("%Y/%m/%d"))
			res = execute_query(squeeze(bq_query), "report", "itadmin@juspay.in")

			run_reports(res, app_name, start.strftime("%Y/%m/%d:%H:%M:%S"))

class AcsMetrics(Resource):
	@auth._is_authorized
	def get(self, userid=None):
		if(users.getRole(userid) == 'Client'):
			return None
		c = connect.ConnectInflux()
		data = c.acsMetrics()
		return data

class LiveSessionStream(Resource):
	@auth._is_authorized
	def get(self, userid=None):
		if(users.getRole(userid) == 'Client'):
			return None
		c = connect.ConnectInflux()
		data = c.liveSessionStream()
		return data

class SupSessions(Resource):
	@auth.apiKeyCheck
	def get(self):
		appname = request.args.get('appname')
		today = datetime.datetime.now()
		start = (today - datetime.timedelta(days=8)).strftime("%Y/%m/%d")
		end = (today - datetime.timedelta(days=1)).strftime("%Y/%m/%d")
		bq_query1 = """
				SELECT
				  app_name, 
				  dt, 
				  (num/tot)*100 AS succ_rate
				FROM (
				  SELECT
					EXACT_COUNT_DISTINCT(session_id) AS tot, 
					SUBSTR(starttime, 1, 10) AS dt, 
					SUM(CASE WHEN is_godel = "T" THEN 1 ELSE 0 END ) AS num, 
					app_name
				  FROM (TABLE_DATE_RANGE(godel_logs.godel_session, TIMESTAMP("{start}"), TIMESTAMP("{end}")))
				  WHERE
					app_name IN ('{appname}')
					AND SUBSTR(starttime, 1, 10) >= "{start}"
					AND SUBSTR(starttime, 1, 10) <= "{end}"
				  GROUP BY
					dt, 
					app_name)
				ORDER BY
				  dt """.format(start=start, end=end, appname=appname)
		res1 = execute_query(squeeze(bq_query1), 'dailydashbrd', '1')

		bq_query2 = """
				SELECT
				  EXACT_COUNT_DISTINCT(session_id) AS total_sessions, 
				  SUM(CASE WHEN is_godel = "T" THEN 1 ELSE 0 END ) AS succ_num
				FROM (TABLE_DATE_RANGE(godel_logs.godel_session, TIMESTAMP("{end}"), TIMESTAMP("{end}")))
				WHERE
				  app_name IN ('{appname}')
				  AND SUBSTR(starttime, 1, 10) = "{end}"
		""".format(appname=appname, end=end)
		res2 = execute_query(squeeze(bq_query2), 'dailydashbrd', '1')

		result = { "item": [{"value" : str(res2.keys()[0]) }, []], "min": {"value": 0}, "max": {"value": 100 } }

		for i in res1[appname]:
			result['item'][1].append(str(int(i['succ_rate'])))

		return result

class PasswordUsage(Resource):
	@auth.apiKeyCheck
	def get(self):
		today = datetime.datetime.now()
		date = (today - datetime.timedelta(days=1)).strftime("%Y%m%d")

		bq_query = """
				(SELECT
				  EXACT_COUNT_DISTINCT(session_id) AS numerator
				FROM
				  [godel_logs.godel_session{date}]
				WHERE
				  ( events.label = "password_display"
					OR events.label = "show_password_text" ));
		""".format(date=date)
		response = execute_query(squeeze(bq_query), 'dailydashbrd', '1')
		numerator = response.keys()[0]

		bq_query = """
				(SELECT
				  EXACT_COUNT_DISTINCT(session_id) AS denominator
				FROM
				  [godel_logs.godel_session{date}]
				WHERE
				  screens.uri LIKE "%PasswordHelperFragment%"
				  OR screens.uri LIKE "%ShowPasswordFragment%");
		""".format(date=date)
		response = execute_query(squeeze(bq_query), 'dailydashbrd', '1')
		denominator = response.keys()[0]

		result = {'items':[]}
		result['items'].append({'label':'Adopted Sessions', 'value':numerator})
		result['items'].append({'label':'Total Sessions', 'value':denominator})
		result['items'].append({'label':'Adopted Rate', 'value':str(round(numerator/denominator*100, 2)) + "%"})

		return result

class UberSuccess(Resource):
	@auth.apiKeyCheck
	def get(self):
		payment_instrument = request.args.get('payment_instrument')
		type = request.args.get('type')
		today = datetime.datetime.now()
		date = (today - datetime.timedelta(days=1)).strftime("%Y%m%d")

		bq_query = """
				SELECT
				  dt, 
				  payment_instrument, 
				  cnt AS total, 
				  experiments, 
				  succ, 
				  (succ/cnt)*100 AS succ_rate
				FROM (
				  SELECT
					SUBSTR(starttime, 1, 10) AS dt, 
					payment_instrument, 
					EXACT_COUNT_DISTINCT(session_id) AS cnt, 
					SUM(CASE WHEN payment_status = "SUCCESS" THEN 1 ELSE 0 END) AS succ, 
					experiments
				  FROM
					[godel_logs.godel_session{date}]
				  WHERE
					experiments IN ("{type}")
					AND payment_instrument = '{payment_instrument}'
				  GROUP BY
					dt, 
					payment_instrument, 
					experiments
				  ORDER BY
					payment_instrument, 
					experiments, 
					dt);
		""".format(date = date, payment_instrument=payment_instrument, type=type)

		response = execute_query(squeeze(bq_query), 'dailydashbrd', '1')
		result = {'item':[]}
		key = (today - datetime.timedelta(days=1)).strftime("%Y/%m/%d")
		for itr in response[key]:
			result['item'].append({'value':str(itr['total']), 'label':'total'})
			result['item'].append({'value':str(itr['succ']), 'label':'successful'})

		return result

class TierOnesuccrate(Resource):
	@auth.apiKeyCheck
	def get(self):
		today = datetime.datetime.now()
		start = (today - datetime.timedelta(days=1)).strftime("%Y/%m/%d")
		end = (today - datetime.timedelta(days=1)).strftime("%Y/%m/%d")

		bq_query = """
				SELECT
				  (succ_num/total_sessions)*100 AS succ_rate, 
				  app_name
				FROM (
				  SELECT
					EXACT_COUNT_DISTINCT(session_id) total_sessions, 
					app_name, 
					SUM(CASE WHEN payment_status = "SUCCESS" THEN 1 ELSE 0 END) AS succ_num
				  FROM (TABLE_DATE_RANGE(godel_logs.godel_session, TIMESTAMP("{start}"), TIMESTAMP("{end}")))
				  WHERE
					app_name IN ('Snapdeal', 
					  'Freecharge', 
					  'MakeMyTrip', 
					  'bookmyshow', 
					  'Cleartrip')
					AND SUBSTR(starttime, 1, 10) >= "{start}"
					AND SUBSTR(starttime, 1, 10) <= "{end}"
				  GROUP BY
					app_name );
		""".format(start=start, end=end)
		response = execute_query(squeeze(bq_query), 'dailydashbrd', '1')
		result = {
				  "x_axis": {
					"labels": []
				  }, 
				  "series": [
					{ 'color': "#52b238", 
					  "data": []
					}
				  ]
				}
		for key, value in response.iteritems():
			result["x_axis"]["labels"].append(value[0]['app_name'])
			result["series"][0]["data"].append(float(key))

		return result

class OtpApprovalAdoptn(Resource):
	@auth.apiKeyCheck
	def get(self):
		today = datetime.datetime.now()
		start = (today - datetime.timedelta(days=31)).strftime("%Y/%m/%d")
		end = (today - datetime.timedelta(days=1)).strftime("%Y/%m/%d")

		bq_query = """
				SELECT
				  dt, 
				  (otp_approved/otp_received)*100 AS adoption_rate, 
				  (auto_otp_succ/otp_approved)*100 AS auto_otp_succ_rate, 
				  (manual_otp_succ/(otp_received - otp_approved))*100 AS manual_otp_succ_rate, 
				FROM (
				  SELECT
					SUBSTR(starttime, 1, 10) AS dt, 
					SUM(CASE WHEN (payment_status = "SUCCESS"
						AND approve_otp='T'
						AND otp_detected = "T" ) THEN 1 ELSE 0 END) AS auto_otp_succ, 
					SUM(CASE WHEN (payment_status = "SUCCESS"
						AND approve_otp='F'
						AND otp_detected='T') THEN 1 ELSE 0 END) AS manual_otp_succ, 
					SUM(CASE WHEN otp_detected = 'T' THEN 1 ELSE 0 END) AS otp_received, 
					SUM(CASE WHEN (approve_otp = 'T'
						AND otp_detected = 'T') THEN 1 ELSE 0 END) AS otp_approved
				  FROM (TABLE_DATE_RANGE(godel_logs.godel_session, TIMESTAMP("{start}"), TIMESTAMP("{end}")))
				  WHERE
					auth_method = "otp"
					AND SUBSTR(starttime, 1, 10) >= "{start}"
					AND SUBSTR(starttime, 1, 10) <= "{end}"
				  GROUP BY
					dt
				  ORDER BY
					dt);
				""".format(start=start, end=end)
		response = execute_query(squeeze(bq_query), 'dailydashbrd', '1')
		res = {'adoption_rate':[], 'auto_otp_succ_rate':[], 'manual_otp_succ_rate':[]}
		series_1 = []
		series_2 = []
		series_3 = []
		for i in response:
			arr1 = []
			arr2= []
			arr3 = []
			date = datetime.datetime.strptime(i, "%Y/%m/%d")
			date = int(date.strftime("%s")) * 1000
			arr1.append(date)
			arr2.append(date)
			arr3.append(date)
			for j in response[i]:
				arr1.append(j['adoption_rate'])
				arr2.append(j['auto_otp_succ_rate'])
				arr3.append(j['manual_otp_succ_rate'])

			series_1.append(arr1)
			series_2.append(arr2)
			series_3.append(arr3)

		series_1.sort(key=lambda x: x[0])
		series_2.sort(key=lambda x: x[0])
		series_3.sort(key=lambda x: x[0])
		res['adoption_rate'] = series_1.sort(key=lambda x: x[0])
		res['auto_otp_succ_rate'] = series_2
		res['manual_otp_succ_rate'] = series_3

		res_gr = {
				'chart': {
					'type': 'spline'
				}, 
				'title': {
					'text': ''
				}, 
				'subtitle': {
					'text': ''
				}, 
				'xAxis': {
					'type': 'datetime', 
					'dateTimeLabelFormats': { # dont display the dummy year
						'month': '%e. %b', 
						'year': '%b'
					}, 
					'title': {
						'text': 'Date'
					}
				}, 
				'yAxis': {
					'title': {
						'text': 'Rate'
					}
				}, 
				'tooltip': {
					'headerFormat': '<b>{series.name}</b><br>', 
					'pointFormat': '{point.x:%e. %b} : {point.y:.2f} %'
				}, 

				'plotOptions': {
					'spline': {
						'marker': {
							'enabled': 'true'
						}
					}
				}, 

				'series': [{
					'color': "#108ec5", 
					'name': 'adoption_rate', 
					'data': []
				}, {
					'color': "#52b238", 
					'name': 'auto_otp_succ_rate', 
					'data': []
				}, {
					'color': "#ee5728", 
					'name': 'manual_otp_succ_rate', 
					'data': []
				}]
			}
		res_gr['series'][0]['data'] = series_1
		res_gr['series'][1]['data'] = series_2
		res_gr['series'][2]['data'] = series_3
		return res_gr

class PIsuccrate2(Resource):
	@auth.apiKeyCheck
	def get(self):
		today = datetime.datetime.now()
		start = (today - datetime.timedelta(days=31)).strftime("%Y/%m/%d")
		end = (today - datetime.timedelta(days=1)).strftime("%Y/%m/%d")

		bq_query = """
				SELECT
				  payment_instrument, 
				  dt, 
				  succ_num/total_sessions * 100 AS succ_rate from(
				  SELECT
					SUBSTR(starttime, 1, 10) AS dt, 
					EXACT_COUNT_DISTINCT(session_id) total_sessions, 
					payment_instrument, 
					SUM(CASE WHEN payment_status = "SUCCESS" THEN 1 ELSE 0 END) AS succ_num
				  FROM (TABLE_DATE_RANGE(godel_logs.godel_session, TIMESTAMP("{start}"), TIMESTAMP("{end}")))
				  WHERE
					SUBSTR(starttime, 1, 10) >= "{start}"
					AND SUBSTR(starttime, 1, 10) <= "{end}"
					AND payment_instrument IN ('HDFC', 
					  'AXIS', 
					  'CITI', 
					  'SBIDC', 
					  'BOBDC', 
					  'ICICICC', 
					  'SBINB', 
					  'CANARA', 
					  'HDFCNB', 
					  'ICICIDC')
				  GROUP BY
					dt, 
					payment_instrument)
				ORDER BY
				  dt;
		""".format(start=start, end=end)
		response = execute_query(squeeze(bq_query), 'dailydashbrd', '1')

		result = {
			'chart': {
				'type': 'area'
			}, 
			'title': {
				'text': ''
			}, 
			'subtitle': {
				'text': ''
			}, 
			'xAxis': {
				'type': 'datetime', 
						'dateTimeLabelFormats': {
							'month': '%e. %b', 
							'year': '%b'
						}, 
						'title': {
							'text': 'Date'
						}
			}, 
			'yAxis': {
				'title': {
					'text': ''
				}, 
			}, 
			'tooltip': {
				'shared': 'true', 
				'valueSuffix': ' %'
			}, 
			'plotOptions': {
				'area': {
					'stacking': 'normal', 
					'lineColor': '#666666', 
					'lineWidth': 1, 
					'marker': {
						'lineWidth': 1, 
						'lineColor': '#666666'
					}
				}
			}, 
			'series': []
		}

		keys = response.keys()
		for i, value in response.iteritems():
			result['series'].append({'name':i, 'data':[]})
			for j in value:
				date = datetime.datetime.strptime(j['dt'], "%Y/%m/%d")
				date = int(date.strftime("%s")) * 1000
				result['series'][keys.index(i)]['data'].append([date, int(j['succ_rate'])])

		return result

class TotalSupSessions(Resource):
	@auth.apiKeyCheck
	def get(self):
		today = datetime.datetime.now()
		start = (today - datetime.timedelta(days=1)).strftime("%Y/%m/%d")
		end = (today - datetime.timedelta(days=1)).strftime("%Y/%m/%d")
		bq_query = """
				SELECT
				  (num/tot)*100 AS rate, 
				  app_name
				FROM (
				  SELECT
					EXACT_COUNT_DISTINCT(session_id) AS tot, 
					SUM(CASE WHEN is_godel = "T" THEN 1 ELSE 0 END ) AS num, 
					app_name
				  FROM (TABLE_DATE_RANGE(godel_logs.godel_session, TIMESTAMP("{start}"), TIMESTAMP("{end}")))
				  WHERE
					app_name IN ('Freecharge', 
					  'Snapdeal', 
					  'bookmyshow', 
					  'Cleartrip', 
					  'MakeMyTrip', 
					  'Voonik', 
					  'redBus', 
					  'TapCibo')
					AND SUBSTR(starttime, 1, 10) >= "{start}"
					AND SUBSTR(starttime, 1, 10) <= "{end}"
				  GROUP BY
					app_name
				  ORDER BY
					tot DESC);
		""".format(start=start, end=end)
		response = execute_query(squeeze(bq_query), 'dailydashbrd', '1')
		result = {
				  "x_axis": {
					"labels": []
				  }, 
				  "series": [
					{
					  "data": []
					}
				  ]
				}
		for key, value in response.iteritems():
			result["x_axis"]["labels"].append(value[0]['app_name'])
			result["series"][0]["data"].append(float(key))
		return result

class PIsuccrate(Resource):
	@auth.apiKeyCheck
	def get(self):
		auth = request.authorization
		today = datetime.datetime.now()
		start = (today - datetime.timedelta(days=31)).strftime("%Y/%m/%d")
		end = (today - datetime.timedelta(days=1)).strftime("%Y/%m/%d")
		bq_query = """
				SELECT
				  payment_instrument, 
				  (succ_num/total_sessions)*100 AS succ_rate, 
				  (succ_num_ystrdy/total_sessions_ystrdy)*100 AS succ_rate_ystrdy
				FROM (
				  SELECT
					EXACT_COUNT_DISTINCT(session_id) total_sessions, 
					payment_instrument, 
					SUM(CASE WHEN payment_status = "SUCCESS" THEN 1 ELSE 0 END) AS succ_num, 
					is_godel, 
					SUM(CASE WHEN SUBSTR(starttime, 1, 10) = "{end}" THEN 1 ELSE 0 END) AS total_sessions_ystrdy, 
					SUM(CASE WHEN (payment_status = "SUCCESS"
						AND SUBSTR(starttime, 1, 10) = "{end}") THEN 1 ELSE 0 END) AS succ_num_ystrdy
				  FROM (TABLE_DATE_RANGE(godel_logs.godel_session, TIMESTAMP("{start}"), TIMESTAMP("{end}")))
				  WHERE
					SUBSTR(starttime, 1, 10) >= "{start}"
					AND SUBSTR(starttime, 1, 10) <= "{end}"
				  GROUP BY
					payment_instrument, 
					is_godel
				  ORDER BY
					total_sessions DESC
				  LIMIT
					10);
		""".format(start=start, end=end)
		response = execute_query(squeeze(bq_query), 'dailydashbrd', '1')
		result = {
			'chart': {
				'type': 'column'
			}, 
			'title': {
				'text': ''
			}, 
			'subtitle': {
				'text': ''
			}, 
			'xAxis': {
				'categories': [], 
				'crosshair': 'true'
			}, 
			'yAxis': {
				'min': 0, 
				'title': {
					'text': 'Success Rate'
				}
			}, 
			'tooltip': {
				'headerFormat': '<span style="font-size:10px">{point.key}</span><table>', 
				'pointFormat': '<tr><td style="color:{series.color};padding:0">{series.name}: </td>' +
					'<td style="padding:0"><b>{point.y:.1f} %</b></td></tr>', 
				'footerFormat': '</table>', 
				'shared': 'true', 
				'useHTML': 'true'
			}, 
			'plotOptions': {
				'column': {
					'pointPadding': 0.2, 
					'borderWidth': 0
				}
			}, 
			'series': [{
				'name': 'Last 30 days', 
				'data': []

			}, {
				'name': 'Yesterday', 
				'data': []

			}]
		}

		for key, value in response.iteritems():
			result["xAxis"]["categories"].append(key)
			result["series"][0]["data"].append(value[0]['succ_rate'])
			result["series"][1]["data"].append(value[0]['succ_rate_ystrdy'])

		return result

class RunCron(Resource):
	@auth.checkKey
	def get(self, userid=None):
		at = request.args.get('at')
		res = scheduler.getJobsbyParent(at)
		last_run = datetime.datetime.now() + datetime.timedelta(minutes=30, hours=5)
		last_run = last_run.strftime("%Y-%m-%d , %I:%M:%S %p")
		scheduler.updateJob(res, last_run)
		createAlert(res, 'itadmin@juspay.in')

class AddJob(Resource):
	def post(self, userid=None):
		"""
		Placeholders for query:
		`today` =  current day
		`nday` = today - timedelta(n days)
		"""
		params = request.get_json(force=True)
		key = params.get("key")
		save_query = params.get("query")
		query = get_date_range(params.get("query"))
		parent_key = params.get("parent_key")
		column = params.get("column")
		threshold = params.get("threshold")
		job_type = params.get("job_type")
		recipient = params.get("recipient")
		action = params.get("action")

		if not correct_recipient_format(recipient):
			return {'value':'Error', 'msg':'Error! Check the recipients'}

		if job_type == "Alert" or job_type == "Callalert":
			column = map(lambda x: x.strip(), column.split(","))
			threshold = map(lambda x: x.strip(), threshold.split(","))

			try:
				result = execute_query(squeeze(query), "custom_query", 'itadmin@juspay.in')
			except:
				return {'value':'Error', 'msg':'Error! Check the query'}

			res = filter(lambda x: x.get('name') in column, result['schema']['fields'])

			if (len(column) != len(threshold)):
				return {'value':'Error', 'msg':'Number of columns and respective threshold values should be equal'}
			if (len(res) < len(column)):
				return {'value':'Error', 'msg':'Column Name does not exist in the schema'}
			if (len(res) > len(column)):
				return {'value':'Error', 'msg':'Repeated column name'}

			for val in res:
				if (type(convert2datatype(threshold[column.index(val.get('name'))], val.get('type'))) in [str, unicode]):
					return {'value':'Error', 'msg':'Wrong datatype'}

			data = {'value':'Error', 'msg':'Duplicate'}
			threshold = ' , '.join(str(x) for x in threshold)
			column = ' , '.join(str(x) for x in column)

		result = scheduler.addJob(parent_key, key, save_query, column, threshold, job_type, action, recipient)
		if result:
			data = {'value':'Success'}

		return data

class GetAlertList(Resource):
	def post(self, userid=None):
		result = scheduler.getJobs()
		return result

class RemoveAlert(Resource):
	def post(self, userid=None):
		params = request.get_json(force=True)
		key = params.get("key")
		parent_key = params.get("parent_key")
		scheduler.rmJob(parent_key, key)

class BillToday(Resource):
	def get(self, userid=None):
		di = {}
		ungrouped_result = []
		date_run = str(datetime.date.today() - datetime.timedelta(days=1)) #for locahost debugging set days=0
		query = ndb.gql('SELECT * FROM BillModel where date_run = :date_run', date_run=date_run)
		row_fetch = query.fetch(100000)
		ungrouped_result = [row.to_dict() for row in row_fetch]
		result = group_it(ungrouped_result, 'bytes_processed', ['email', 'user', 'project', 'environment'])
		records = [{'insertId': str(uuid.uuid4()), 'json': rec} for rec in result]
		resp = streaming_rows('godel-big-q', 'billing', 'bill', rows=records)
		ndb.delete_multi([row.key for row in row_fetch])
		return 'billed'


class SearchId(Resource):
	@auth._is_authorized
	def post(self, userid=None):
		params = request.get_json(force=True)
		txn_id = params.get("txn_id").replace("'", "")
		txn_id = "".join(txn_id.split())
		dates = params.get('dates')
		dates = dates.replace(',', '').split(' - ')
		start = datetime.datetime.strptime(dates[0], '%B %d %Y').strftime('%Y/%m/%d')
		end = datetime.datetime.strptime(dates[1], '%B %d %Y').strftime('%Y/%m/%d')
		app_name = get_app_name(userid, 'All' if is_juspay(userid) else params.get("client_id"))
		app_name = check_for_all(app_name, userid)
		if is_bank(userid):
			app_name = 'app_name in ' + str(preffered_merchants) + ' and payment_instrument IN' + str(bank_to_pi.get((get_app_name(userid, params.get("clientID")))))+' AND'
		start, end, start_with_time, end_with_time = check_date_length(start, end, userid)
		if in_utc(userid):
			at = '''date_add(at, -330, 'minute') as at '''
		else:
			at = 'at'
		bq_query = '''
					SELECT
					  sess, 
					  session_id, 
					  oid, 
					  payment_gateway, 
					  aggregator, 
					  {at}, 
					  pg_payment_status, 
					  bank_payment_status, 
					  payment_status, 
					  latency, 
					  bank, 
					  dropout_reasons, 
					  aggr_req_latency, 
					  pg_req_latency, 
					  bank_latency, 
					  aggr_res_latency, 
					  pg_res_latency, 
					  merchant_id, 
					  CASE WHEN auth_method == 'otp'
						AND otp_detected == 'T' THEN 'OTP Detected Successfully' WHEN auth_method == 'otp'
						AND otp_detected == 'F' and payment_status == 'SUCCESS' THEN 'OTP entered Manually' WHEN auth_method == 'otp'
						AND otp_detected == 'F' and payment_status == 'FAILURE' THEN 'Could Not Detected OTP' WHEN auth_method == 'password' THEN 'Auth Using Password' ELSE 'unknown' END AS auth_status, 
					  cnt
					FROM (
					  SELECT
						'session' AS sess, 
						session_id, 
						coalesce(order_id, transaction_id) as oid, 
						payment_gateway, 
						aggregator, 
						otp_detected, 
						at, 
						auth_method, 
						pg_payment_status, 
						bank_payment_status, 
						payment_status, 
						latency, 
						coalesce(bank, payment_instrument) as bank, 
						dropout_reasons, 
						aggr_req_latency, 
						pg_req_latency, 
						bank_latency, 
						aggr_res_latency, 
						pg_res_latency, 
						merchant_id, 
						COUNT(session_id) AS cnt
					  FROM
						TABLE_DATE_RANGE([godel_logs.godel_session], TIMESTAMP('{start}'), TIMESTAMP('{end}'))
					  WHERE
						{app_name}
						(transaction_id == '{txn_id}'
						OR order_id == '{txn_id}')
					  GROUP BY
						oid, 
						session_id, 
						payment_gateway, 
						aggregator, 
						otp_detected, 
						at, 
						bank, 
						auth_method, 
						pg_payment_status, 
						bank_payment_status, 
						payment_status, 
						dropout_reasons, 
						aggr_req_latency, 
						pg_req_latency, 
						bank_latency, 
						aggr_res_latency, 
						pg_res_latency, 
						merchant_id, 
						latency
					  ORDER BY
						at desc )
					'''.format(txn_id = txn_id, app_name = app_name, start = start, end = end, at=at)

		response = execute_query(squeeze(bq_query), 'dailydashbrd', userid)
		resp  =  response.get("session")
		dummy_id = 0
		for x in resp:
			dummy_id  += 1
			ts = int(x.get('at')) + 19800
			timee = datetime.datetime.fromtimestamp(ts).strftime("%-d %b'%y at %-H:%M:%S")
			x['timee'] = timee
			if is_juspay(userid) == False:
				x['session_id'] = dummy_id
		return resp

class BankIcons(Resource):
	def get(self, userid=None):
		return bank_icon_list


authapis = {
	"development":"http://juspaysso-beta.ap-southeast-1.elasticbeanstalk.com/api/", 
	"production" :"http://juspaysso-prod.ap-southeast-1.elasticbeanstalk.com/api/"

}
class AuthSso(Resource):
	def post(self):
		params = request.get_json(force=True)
		headers = None
		env = 'development' if IS_DEV_APPSERVER else 'production'
		token = params.get('token', None)
		if token:
			headers = {'x-auth-token':token}
			params.pop('token')
		url = authapis[env] + params['api']
		params.pop('api')
		r = requests.post(url, params, headers=headers)
		return json.loads(str(r.text))



## Api resource routing

# Extras
api.add_resource(PIsuccrate, '/bq/pisuccrate')
api.add_resource(TotalSupSessions, '/bq/totalsupsessions')

# Daily Dashboard - Geckoboard
# api.add_resource(PIsuccrate2, '/bq/pisuccrate2')
# api.add_resource(OtpApprovalAdoptn, '/bq/otpapprovaladoptn')
# api.add_resource(TierOnesuccrate, '/bq/tieronesuccrate')
# api.add_resource(UberSuccess, '/bq/ubersuccess')
# api.add_resource(PasswordUsage, '/bq/passwordusage')
# api.add_resource(SupSessions, '/bq/supsessions')

api.add_resource(RemoveAlert, '/cron/removealert')
api.add_resource(GetAlertList, '/cron/getalertlist')
api.add_resource(AddJob, '/cron/addjob')
api.add_resource(RunCron, '/cron/runcron')


api.add_resource(LiveSessionStream, '/livesessionstream')
api.add_resource(AcsMetrics, '/acsmetrics')
api.add_resource(Logout, '/logout')

api.add_resource(Navbar, '/users/navbar')
api.add_resource(EditUser, '/users/edituser')
api.add_resource(UpdateUser, '/users/updateusers')
api.add_resource(AddUser, '/users/adduser')
api.add_resource(StorePrefs, '/users/storeprefs')
api.add_resource(GetPrefs, '/users/getprefs')

# Base APIs
api.add_resource(DelQuery, '/customquery/delquery')
api.add_resource(UpdateQuery, '/customquery/updatequery')
api.add_resource(ExecPlaceholderQuery, '/bq/testquery')
api.add_resource(CustomQuery, '/bq/customquery')
api.add_resource(GetFilters, '/bq/filters')
api.add_resource(GetCounts, '/bq/counts')
api.add_resource(GetSegments, '/bq/segments')
api.add_resource(GetFunnels, '/bq/funnels')
api.add_resource(GetFunnelData, '/bq/funnel_data')
api.add_resource(GetSessions, '/bq/sessions')
api.add_resource(ExecQuery, '/bq/execquery')
api.add_resource(DownloadSessions, '/bq/csvsessions')
api.add_resource(GetClients, '/bq/clients')
api.add_resource(GetSegmentMetric, '/bq/segmentMetrics')
api.add_resource(GetDropoutReasons, '/bq/dropoutReasons')
api.add_resource(CustomerList, '/search')
api.add_resource(SearchId, '/bq/searchId')


# Reports and alerts
api.add_resource(Reports, "/tasks/reports")
api.add_resource(SuccessRateAlerts, "/tasks/successAlerts")
api.add_resource(ModifyPageAlerts, "/tasks/modifyPageAlerts")
api.add_resource(GodelCoverageAlerts, "/tasks/godelAlerts")

# Billing
api.add_resource(BillToday, "/tasks/billtoday")

# External - For GettingStarted
api.add_resource(BankIcons, '/banks')

api.add_resource(AuthSso, '/authsso')

