import hashlib
from google.appengine.api import memcache
from angular_flask import app
import pickle

MAX_CHUNKS = 32
CHUNK_SIZE = 950000
MAX_KEY_SIZE = 100

## Memcache has 1M limit per value.
## If value is bigger, we chunk it into multiple entries

class Cache(object):
	def __make_key(self, scope, key):
		if len(key) > MAX_KEY_SIZE:
			m = hashlib.md5()
			m.update(key)
			key = m.hexdigest()
		return '%s.%s' % (scope,key)

	def put(self, scope, key, str_val, expiry):
		if(len(str_val) < CHUNK_SIZE*MAX_CHUNKS):
			k = self.__make_key(scope,key)
			values = {}
			for i in xrange(0, len(str_val), CHUNK_SIZE):
				values['%s.%s' % (k, i//CHUNK_SIZE)] = str_val[i : i+CHUNK_SIZE]
			app.logger.info('cache: storing keys' + str(values.keys()))
			memcache.set_multi(values, time=expiry)
			return True
		else:
			return False

	def get(self, scope, key):
		k = self.__make_key(scope,key)
		result = memcache.get_multi(['%s.%s' % (k, i) for i in xrange(MAX_CHUNKS)])
		app.logger.info('cache: retrieved keys' + str(result.keys()))
		if(result):
			return ''.join([v for k,v in sorted(result.items()) if v is not None])
		else:
			return None
