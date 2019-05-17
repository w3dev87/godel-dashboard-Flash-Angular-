from angular_flask import app
import influxdb
from influxdb import InfluxDBClient

class ConnectInflux():
	def __init__(self):
		self.client = InfluxDBClient('influxdb-prod.juspay.in',8086,'realtime-user', 'MgqEK,nWx2bV','godel-realtime')
	
	
	def acsMetrics(self):
		query1 = "select count(distinct(session_id)) as sess_count from \
				payment_details_data where time > now() - 5m and session_id<>'null' and \
				bank<>'null' and app_name<>'null' group by \
				acs_hash"
		query2 = "select count(distinct(session_id)) from \
				payment_details_data where time > now() - 5m and session_id<>'null' and \
				bank<>'null' and app_name<>'null' and payment_status='SUCCESS' group by \
				acs_hash"
		query3 = "select count(distinct(session_id)) ,sum(potential_payment_flow_error) \
				  as pay_error,sum(user_error) as user_error ,sum(godel_exception) as exp,\
				  sum(acs_error) as acs_error from session_aggregates where time> now() - 5m \
				  and session_id<>'null' and bank<>'null' and app_name<>'null' group by acs_hash"
		result1 = self.client.query(query1)
		result2 = self.client.query(query2)	
		result3 = self.client.query(query3)	
		
		join_list = {}
		for i in result1[0]['points']:
			join_list[i[2]] = [i[1],0,0,0,0,0]  #l-4 :u'pay_error', u'user_error', u'exp', u'acs_error', u'acs_hash'

		for i in result2[0]['points']:
			if i[2] in join_list:
				join_list[i[2]][1] = i[1]
			else:
				join_list[i[2]] = [0,i[1],0,0,0,0]

		for i in result3[0]['points']:
			if i[6] in join_list:
				join_list[i[6]][2] = i[2]
				join_list[i[6]][3] = i[3]
				join_list[i[6]][4] = i[4]
				join_list[i[6]][5] = i[5]
			else:
				join_list[i[6]] = [0,0,i[2],i[3],i[4],i[5]]

		res = {'columns':['acs_hash','tot_sess_count','success_count','success_rate','potential_error', 'user_error', 'godel_exception', 'acs_error'],'rows':[]}
		map_column = {}
		for i in join_list:
			row = []
			row.append(i)
			row.append(join_list[i][0])
			row.append(join_list[i][1])
			if join_list[i][0]==0:
				row.append('not-def')
			else:
				row.append(round(float(join_list[i][1])/float(join_list[i][0])*100,2))
			row.append(join_list[i][2])
			row.append(join_list[i][3])
			row.append(join_list[i][4])
			row.append(join_list[i][5])
			res['rows'].append(row)

		return res

	def liveSessionStream(self):
		query = "select session_id, acs_hash, bank, name, numscreens, numevents, acs_error,\
				 potential_payment_flow_error,user_error,godel_exception from \
				 internal_session_aggregates where time > now() - 5m"
		
		res = {'columns':[],'rows':[]}
		result = self.client.query(query)
		columns=['session_id','acs_hash','bank','name' ,'numscreens','acs_error', 'potential_payment_flow_error','user_error','godel_exception']
		map_list = {}
		
		for i,j in enumerate(result[0]['columns']):
			map_list[j] =i 

		for i in result[0]['points']:
			arr = []
			for j in columns:
				arr.append(i[map_list[j]])
			res['rows'].append(arr)

		res['columns'] = columns
		return res
