## Service Interfaces / Abstract classes
class Auth:
    def get_auth_uri(self):
        return 'NA'

    def handle_auth_uri_response(self):
        return 'NA'

    def _is_authorized(self,fn):
        return 'NA'

    def _is_admin(self,fn):
        return 'NA'

    def __validate_token(self,access_token):
        return 'NA'

class Cache:
    def get(self, key_data):
        return 'NA'

    def put(self, key_data, key):
        return 'NA'

class Query:
    def query(self,bq_query,uid):
        return 'NA'

class Users:
    def addUser(self, email, role):
        return 'NA'

    def getRole(self, key_name):
        return 'NA'

    def getAppname(self, key_name):
        return 'NA'

    def keyExists(self, key_name):
        return 'NA'

    def getAllUsers(self):
        return 'NA'

    def delUser(self, key_name):
        return 'NA'

    def generateKey(self, key_name):
        return 'NA'

    def is_super_user(self, email):
        return 'NA'

    def getPrefs(self, email, identity):
        return 'NA'

    def storePrefs(self, email, identity, val):
        return 'NA'

class Customquery:
    def add(self, query_id, bq_query, userid):
        return 'NA'

    def getQuery(self, key_name):
        return 'NA'

    def keyExists(self, key_name):
        return 'NA'

    def getAll(self, userid):
        return 'NA'

    def delQuery(self, key_name):
        return 'NA'

    def generateKey(self, key_name):
        return 'NA'

class Scheduler:
    def addJob(self, parent_key, key, query, column_name, threshold, last_run):
        return 'NA'

    def updateJob(self, job_list, last_run):
        return 'NA'

    def getJobs(self):
        return 'NA'

    def rmJob(self, parent_key, key):
        return 'NA'

    def ifKeyExists(self, parent_key, key):
        return 'NA'

    def getJobsbyParent(self, parent_key):
        return 'NA'



class Email:
    def send_email(self, e_to, e_from, e_body, e_subject, e_att_name, e_att_file):
        return 'NA'

class Bill:
    def input_info(self,job_id,bytes_processed,cost):
        return 'NA'

from angular_flask import settings
if settings.HOSTINGENV == 'APPENGINE':
    import angular_flask.hosting.google
    hosting_env = angular_flask.hosting.google
elif settings.HOSTINGENV == 'AWS':
    raise NotImplementedError('AWS TBD')
else:
    raise NotImplementedError('Wrong HOSTINGENV: ' + settings.HOSTINGENV)


def get_service(service_type):
    __import__(hosting_env.__name__ + '.' + service_type)
    return getattr(getattr(hosting_env, service_type),service_type.capitalize())()

# preserve order
bill = get_service("bill")
email = get_service("email")
customquery = get_service("customquery")
scheduler = get_service("scheduler")
users = get_service("users")
cache = get_service("cache")
auth = get_service("auth")
query = get_service("query")


