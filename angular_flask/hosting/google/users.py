import datetime
from google.appengine.ext import db
from google.appengine.api import users
from ..services import Users
import simplejson

class JsonProperty(db.TextProperty):
	def validate(self, value):
		try:
			result = simplejson.dumps(value)
			return value
		except:
			return super(JsonProperty, self).validate(value)

	def get_value_for_datastore(self, model_instance):
		result = super(JsonProperty, self).get_value_for_datastore(model_instance)
		result = simplejson.dumps(result)
		return db.Text(result)

	def make_value_from_datastore(self, value):
		try:
			value = simplejson.loads(str(value))
		except:
			pass
		return super(JsonProperty, self).make_value_from_datastore(value)

class UserModel(db.Model):
	email = db.StringProperty(required=True)
	role = db.StringProperty(required=True, choices=set(["Super", "Admin", "Juspay", "Client", "Bank", "Pg"]))
	appname = db.StringProperty(required=True)
	timeformat = db.StringProperty(required=False, choices=set(["UTC", "IST"]))
	config = JsonProperty()

class Users(Users):
	def __init__(self):
		self.intern_devs = []
		self.super_user = ["abdur.rahman@juspay.in", "boaz.john@juspay.in", "ramanathan@juspay.in", "vimal.kumar@juspay.in", "rinil@juspay.in", "chaitanya@juspay.in", "kiran.kumar@juspay.in"] + self.intern_devs

	def addUser(self, email, role, appname=None):
		if email in [i['email'] for i in self.getAllUsers()]:
			return
		if(email.split("@")[0] == '*'):
			role = "Client"
		q = UserModel.all().filter("email =", email)
		if (q.get() == None):
			if appname in [None,'']: 
				appname = self.generate_appname(email)
			u = UserModel(key_name=email, email=email, role=role, appname=appname, config={})
			u.put()
			return "true"
		else:
			return "false"

	def editUser(self, email, role, appname,timeformat):
		if(email.split("@")[0] == '*'):
			role = "Client"
		q = UserModel.all().filter("email =", email)
		if (q.get() == None):
			return "false"
		else:
			config = self.getConfigForUser(email)
			u = UserModel(key_name=email, email=email, role=role, appname=appname, timeformat=timeformat, config=config)
			u.put()
			return "true"

	def getPrefs(self, email, identity):
		all_users = self.getAllUsers()
		data = []
		for user in all_users:
			if user['email'] == email:
				try:
					data = [i.encode('ascii','replace') for i in user['config'][identity]]
				except KeyError:
					data = []
		return data

	def getConfigForUser(self, email):
		all_users = self.getAllUsers()
		for user in all_users:
			if user['email'] == email:
				try:
					return user['config']
				except KeyError:
					return {}
		return {}

	def storePrefs(self, email, identity, val):
		all_users = self.getAllUsers()
		for user in all_users:
			if user['email'].encode('ascii','replace') == email:
				if identity in user['config']:
					history = [i.encode('ascii','replace') for i in user['config'][identity]]
					if val in history:
						break
					history.append(val)
					u = UserModel(key_name=email, email=email, role=user['role'], appname=user['appname'], timeformat=user['timeformat'], config={identity:history})
					u.put()
					break
				else:
					history = [val]
					u = UserModel(key_name=email, email=email, role=user['role'], appname=user['appname'], timeformat=user['timeformat'], config={identity:history})
					u.put()
					break
		return 	self.getPrefs(email, identity)


	def getRole(self, key_name):
		if(key_name in self.super_user):
			return "Super"
		if self.keyExists(key_name) == "false":
			key_name = self.get_domain(key_name)
		key = self.generateKey(key_name)
		if key:
			return key.role


	def getAppname(self, key_name):
		if key_name in self.super_user:
			return "Juspay"
		if self.keyExists(key_name) == "false":
			key_name = self.get_domain(key_name)
		key = self.generateKey(key_name)
		if key:
			return key.appname

	def getTimeformat(self, key_name):
		if self.keyExists(key_name) == "false":
			print 'returns UTC'
			return "UTC"
		key = self.generateKey(key_name)
		if key and key.timeformat:
			print ('timeformat=================',key.timeformat)
			return key.timeformat
		return "UTC"

	def keyExists(self, key_name):
		q = UserModel.all()
		q.filter("email =", key_name)
		if (q.get() == None):
			return "false"
		else:
			return "true"

	def getAllUsers(self):
		q = UserModel.all()
		data = []
		for p in q.run():
			obj = {}
			obj['email'] = p.email
			obj['role'] = p.role
			obj['appname'] = p.appname
			obj['config'] = p.config
			obj['timeformat'] = p.timeformat
			data.append(obj)
		return data

	def delUser(self, key_name):
		key = self.generateKey(key_name)
		db.delete(key)

	def generateKey(self, key_name):
		address_k = db.Key.from_path('UserModel', key_name)
		return db.get(address_k)

	def generate_appname(self, userid):
		domain = userid.split("@")[1]
		domain_list = {'juspay.in': 'Juspay', 'freecharge.com': 'Freecharge', 'snapdeal.com': 'Snapdeal', \
						'redbus.in': 'redBus', 'tinyowl.co.in': 'TinyOwl', 'cleartrip.com': 'Cleartrip', \
						'bookmyshow.com': 'bookmyshow', 'mobikwik.com': 'MobiKwik'}
		if domain in domain_list.keys():
			return domain_list[domain]
		else:
			return "empty"

	def get_domain(self, userid):
		domain = userid.split("@")[1]
		return '*@' + domain

	def is_super_user(self, email):
		if email in self.super_user:
			return True
		else:
			return False


