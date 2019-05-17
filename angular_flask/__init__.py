import sys
import os
import json
from login_config import login_config

from google.appengine.api.app_identity import get_application_id


# Setting default encoding
reload(sys)
sys.setdefaultencoding("utf-8")

IS_DEV_APPSERVER = 'development' in os.environ.get('SERVER_SOFTWARE', '').lower()



APP_ENV = 'production'
server_name =  os.environ.get('SERVER_NAME', '').lower()

if 'localhost' == server_name:
	APP_ENV = 'development'
elif 'juspay-analytics-test.appspot.com' == server_name:
	APP_ENV = 'beta'
else:
	APP_ENV = 'production'

LOGIN_CONFIG = login_config.get(APP_ENV)
sys.path.insert(0, 'angular_flask/lib')


from flask import Flask, request, Response
from flask import render_template, send_from_directory, url_for
from flask.ext.restful import Api

app = Flask(__name__)

app.config.from_object('angular_flask.settings')

app.url_map.strict_slashes = False

import hosting.services

api = Api(app)

import angular_flask.models
import angular_flask.controllers


from flask.ext.compressor import Compressor, Asset, CSSBundle, JSBundle
from angular_flask import assets as assetBundle

# Bundling and minifiying assets
compressor = Compressor(app)

common_js = JSBundle('common_js', assets=assetBundle.common_js, processors=['jsmin'])
common_css = CSSBundle('common_css', assets=assetBundle.common_css, processors=['cssmin'])
adm_js = JSBundle('adm_js', assets=assetBundle.adm_js, processors=['jsmin'])
adm_css = CSSBundle('adm_css', assets=assetBundle.adm_css, processors=['cssmin'])
faq_css = CSSBundle('faq_css', assets=assetBundle.faq_css, processors=['cssmin'])
realtime_js = JSBundle('realtime_js', assets=assetBundle.common_js, processors=['jsmin'])
realtime_css = CSSBundle('realtime_css', assets=assetBundle.common_css, processors=['cssmin'])

# Registering bundles
compressor.register_bundle(common_js)
compressor.register_bundle(common_css)
compressor.register_bundle(adm_js)
compressor.register_bundle(adm_css)
compressor.register_bundle(faq_css)
compressor.register_bundle(realtime_js)
compressor.register_bundle(realtime_css)



