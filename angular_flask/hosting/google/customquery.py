import datetime
from google.appengine.ext import db
from google.appengine.api import users
from ..services import Customquery

class CustomqueryModel(db.Model):
	query_id = db.StringProperty(required=True)
	bq_query = db.TextProperty(required=True)
	userid = db.StringProperty(required=True)

class Customquery(Customquery):
	def add(self, query_id, bq_query, userid):
		q = CustomqueryModel.all()
		q.filter("query_id =", query_id)
		q.filter("userid =", userid)
		if (q.get() == None):
			u = CustomqueryModel(key_name=query_id, query_id=query_id, bq_query=bq_query, userid=userid)
		  	u.put()
		  	return "true"
		else:
			return "false"

	def getQuery(self, key_name):
		key = self.generateKey(key_name)
		return key.bq_query

	def keyExists(self,key_name):
		q = CustomqueryModel.all()
		q.filter("query_id =", key_name)
		if (q.get() == None):
			return "false"
		else:
			return "true"

	def getAll(self, userid):
		q = CustomqueryModel.all()
		q.filter("userid =", userid)
		data = []
		for p in q.run():
			obj = {}
			obj['query_id'] = p.query_id
			obj['bq_query'] = p.bq_query
			data.append(obj)
		return data

	def delQuery(self, key_name):
		key = self.generateKey(key_name)
		db.delete(key)

	def generateKey(self, key_name):
		address_k = db.Key.from_path('CustomqueryModel', key_name)
		key = db.get(address_k)
		return key
