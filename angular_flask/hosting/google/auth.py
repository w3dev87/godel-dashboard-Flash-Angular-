from angular_flask import app, IS_DEV_APPSERVER,settings,LOGIN_CONFIG
import json
import jwt
from ..services import Auth
from ..services import cache
from ..services import users

from flask import Flask, redirect, url_for, session, request, jsonify, make_response
from flask.ext import restful
from flask.ext.restful import marshal_with, reqparse, Api, Resource, abort

from oauth2client.client import flow_from_clientsecrets

from oauth2client.file import Storage
from google.appengine.ext import db
from oauth2client.appengine import CredentialsProperty
from oauth2client.appengine import StorageByKeyName
from oauth2client.tools import run

from google.appengine.api.app_identity import get_application_id

import uuid as uuid_lib
import inspect

import httplib2, urllib
from functools import wraps
from oauth2client.client import OAuth2WebServerFlow
import time

http = httplib2.Http()

class CredentialsModel(db.Model):
    credentials = CredentialsProperty()

flow = flow_from_clientsecrets('angular_flask/config/client_secrets_%s.json' % get_application_id(),
                               scope='https://www.googleapis.com/auth/bigquery https://www.googleapis.com/auth/userinfo.email',
                               redirect_uri=(('https://%s.appspot.com/authorized' % get_application_id()) if not IS_DEV_APPSERVER else 'http://localhost:8080/authorized'))

def verify_token(token):
    try:
        decoded = jwt.decode(token,LOGIN_CONFIG.get('jwt_key'))
    except jwt.InvalidTokenError:
        abort(403)

class Auth(Auth):

    def get_auth_uri(self):
        return flow.step1_get_authorize_url()
    

    def handle_auth_uri_response(self, code):
        auth_code = str(code)
        creds = flow.step2_exchange(auth_code)
        session_uuid = str(uuid_lib.uuid4())
        access_token = json.loads(creds.to_json())['access_token']
        email = json.loads(creds.to_json())['id_token']['email']
        domain = '*@'+email.split("@")[1]
        if users.keyExists(email) == 'false' and not users.is_super_user(email):
            if users.keyExists(domain) == 'false':
                abort(403)
        storage = StorageByKeyName(CredentialsModel, session_uuid, 'credentials')
        storage.put(creds)
        cache.put('systemscope', session_uuid, str(time.time() + float(86400)), 86400)
        return (session_uuid,access_token, email)

    def delete_cred(self):
        session_uuid = request.cookies.get('session_uuid')
        if session_uuid:
            address_k = db.Key.from_path('CredentialsModel', session_uuid)
            key = db.get(address_k)
            if key:
                db.delete(key)

    #geckoboard
    def apiKeyCheck(self,fn):
        @wraps(fn)
        def _wrap(*args, **kwargs):
            auth = request.authorization
            if auth.get('username') == 'kYkCcLfbhGgmKwbxjQPjQOic_dpE9qN^XOM0 vG3O34NXt+HjTl4dROJjvcH':
                return fn(*args, **kwargs)
            else:
                abort(403)
        return _wrap

    def checkKey(self,fn):
        @wraps(fn)
        def _wrap(*args, **kwargs):
            key = request.args.get('key')
            if key == 'aMkrBw3VFJX1izx65234wbp73krF7fC5':
                return fn(*args, **kwargs)
            else:
                abort(403)
        return _wrap

    def _is_admin(self,fn):
        @wraps(fn)
        def _wrap(*args, **kwargs):
            session_uuid = request.cookies.get('session_uuid')
            if not session_uuid:
                abort(403)
            authtype = str(request.cookies.get('authtype'))
            if authtype == 'customauth':
                email = str(request.cookies.get('email'))
            else:
                storage = StorageByKeyName(CredentialsModel, session_uuid, 'credentials')
                creds = storage.get()
                if not creds:
                    self.delete_cred()
                    abort(403)
                email = json.loads(creds.to_json())['id_token']['email']
            if users.getRole(email) in ['Super', 'Admin']:
                return fn(role=users.getRole(email),*args, **kwargs)
            self.delete_cred()
            abort(403)

        return _wrap

    def _is_authorized(self,fn):
        """
        Usage:
        @app.route("/")
        @authorized
        def secured_root(userid=None):
            pass
        """
        @wraps(fn)
        def _wrap(*args, **kwargs):
            # if 'Authorization' not in request.headers:
            #     app.logger.error("No token in header : " + str(request.headers))
            #     abort(403)
            #     return None

            app.logger.info("app id: " + get_application_id())

            session_uuid = str(request.cookies.get('session_uuid'))
            if session_uuid == '':
                self.delete_cred()
                abort(403)
            authtype = str(request.cookies.get('authtype'))
            if authtype == 'customauth':
                email = str(request.cookies.get('email'))
                verify_token(str(request.cookies.get('access_token')))

            else:
                storage = StorageByKeyName(CredentialsModel, session_uuid, 'credentials')
                creds = storage.get()
                if not creds:
                    self.delete_cred()
                    abort(403)
                email = json.loads(creds.to_json())['id_token']['email']
            if email is None:
                app.logger.error("Check returned FAIL!")
                self.delete_cred()
                abort(403)
            return fn(userid=email, *args, **kwargs)
        return _wrap
