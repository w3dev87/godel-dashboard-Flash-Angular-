from google.appengine.ext import db
from ..services import Scheduler

class ScheduleModel(db.Model):
	# key_name = 
	# key_name = type
	#every1hr
	#every6hr
	#every12hr
	#every1day
	#every1week
	pass


class JobModel(db.Model):
	# key_name = key
	query = db.TextProperty(required=True)
	column_name = db.StringProperty(required=True)
	threshold = db.StringProperty(required=True)
	last_run = db.StringProperty()
	job_type = db.StringProperty(required=True)
	recipient = db.StringProperty(required=True)

class Scheduler(Scheduler):
	# ADD JOB IF ALREADY DOES NOT EXIST ELSE RETURN FALSE
	def addJob(self, parent_key, key, query, column_name, threshold, job_type, action, recipient, last_run=""):
		k2 = db.Key.from_path('ScheduleModel', parent_key)
		q = ScheduleModel.all().filter("__key__=", k2)

		if (q.get() == None):
			obj = ScheduleModel(key_name=parent_key)
			obj.put()
		if not self.ifKeyExists(parent_key, key):
			job = JobModel(parent=k2, key_name=key, query=query, column_name=column_name, threshold=threshold,\
							 last_run=last_run, job_type=job_type, recipient=recipient)
			job.put()
			return True

		elif action == 'edit':
			self.rmJob(parent_key=parent_key, key=key)
			job = JobModel(parent=k2, key_name=key, query=query, column_name=column_name, threshold=threshold,\
							 last_run=last_run, job_type=job_type, recipient=recipient)
			job.put()
			return True
		else:
			return False

	def updateJob(self, job_list, last_run):
		for job in job_list:
			parent_key = job['at']
			k2 = db.Key.from_path('ScheduleModel', parent_key)
			q = ScheduleModel.all().filter("__key__=", k2)
			if (q.get() == None):
				obj = ScheduleModel(key_name=parent_key)
				obj.put()
			job = JobModel(parent=k2, key_name=job['key'], query=job['query'], column_name=job['column_name'],\
					threshold=job['threshold'], last_run=last_run, job_type=job['job_type'],recipient=job['recipient'])
			job.put()

	# RETURNS A LIST OF ALL JOBS
	def getJobs(self):
		parent_keys = []
		q = ScheduleModel.all()
		for p in q.run():
			parent_keys.append(p.key().id_or_name())

		job_list = []
		for parent_key in parent_keys:
			k2 = db.Key.from_path('ScheduleModel', parent_key)
			q = JobModel.all()
			q.ancestor(k2)
			for p in q.run():
				job_list.append({'key': p.key().id_or_name(), 'at': parent_key, 'query': p.query, 'column_name': p.column_name,\
					'threshold': p.threshold, 'last_run': p.last_run, 'job_type':p.job_type, 'recipient': p.recipient})

		return job_list

	# DELETE A JOB
	def rmJob(self, parent_key, key):
		c1 = db.Key.from_path('ScheduleModel', parent_key, 'JobModel', key)
		db.delete(c1)

	# CHECK IF A KEY EXISTS FOR A JOB
	def ifKeyExists(self, parent_key, key):
		c1 = db.Key.from_path('ScheduleModel', parent_key, 'JobModel', key)
		q = JobModel.all().filter("__key__ =", c1)
		if(q.get() == None):
			return False
		return True

	#RETURN LIST OF JOBS BY parent_key
	def getJobsbyParent(self, parent_key):
		job_list = []
		k2 = db.Key.from_path('ScheduleModel', parent_key)
		q = JobModel.all()
		q.ancestor(k2)
		for p in q.run():
			job_list.append({'key': p.key().id_or_name(), 'at': parent_key, 'query': p.query, 'column_name': p.column_name,\
					'threshold': p.threshold, 'last_run': p.last_run, 'job_type': p.job_type, 'recipient':p.recipient})
		return job_list
