from google.appengine.ext import ndb
from ..services import Bill
import datetime
from google.appengine.api.app_identity import get_application_id
from angular_flask import app, IS_DEV_APPSERVER


class BillModel(ndb.Model):
	bytes_processed = ndb.FloatProperty(required=True)
	user = ndb.StringProperty(required=False)
	email = ndb.StringProperty(required=False)
	date_run = ndb.StringProperty(required=False)
	project  = ndb.StringProperty(required=False)
	environment = ndb.StringProperty(required=False)



class Bill(Bill):
	def input_info(self,job_id,bytes_processed,user,email):
		bytes_processed = float(bytes_processed)
		project = get_application_id()
		environment = 'dev' if IS_DEV_APPSERVER else 'prod'
		if bytes_processed:
			date_run = str(datetime.date.today())
			b = BillModel(bytes_processed=bytes_processed,user=user,email=email,date_run=date_run,\
							project=project,environment=environment)
			b.put()
		return "True"
