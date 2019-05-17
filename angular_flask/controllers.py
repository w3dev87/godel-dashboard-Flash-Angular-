import os
import sys
import datetime
import uuid as uuid_lib
import time
from .hosting.services import cache
from google.appengine.ext import db
from oauth2client.appengine import CredentialsProperty
# from google.appengine.api import users

from oauth2client.appengine import StorageByKeyName
from angular_flask.hosting.services import auth, users
# from angular_flask.hosting.google import users
from angular_flask import app, IS_DEV_APPSERVER, LOGIN_CONFIG
from angular_flask.hosting.services import auth, query, users
from util import get_app_name
# routing for API endpoints (generated from the models designated as
# API_MODELS)
import jwt
import logging
import urlparse
from flask import Flask, request, Response
from flask import render_template, url_for, redirect, send_from_directory
from flask import send_file, make_response, abort
import json
from login_config import login_config
from data import jwt_key


login_config = LOGIN_CONFIG


def verify_token(token):
    try:
        decoded = jwt.decode(token, LOGIN_CONFIG.get('jwt_key'))
        if decoded:
            return True
        else:
            return False
    except jwt.InvalidTokenError:
        return False


class CredentialsModel(db.Model):
    credentials = CredentialsProperty()


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/admin')
@auth._is_admin
@auth._is_authorized
def admin(**kwargs):
    return render_template('admin.html')


@app.route('/custom_query')
@auth._is_admin
@auth._is_authorized
def custom_query(**kwargs):
    return render_template('custom_query.html')

# def login_opt(**kwargs):
#     return render_template('login_opt.html')


@app.route('/login_opt')
def login_opt(**kwargs):
    return render_template('login_opt.html')


@app.route('/register_user')
@auth._is_admin
def register_user(**kwargs):
    return render_template('register_user.html')


@app.route('/update_user')
def update_user(**kwargs):
    return render_template('update_user.html')


@app.route('/login')
def login():

    token = request.cookies.get('access_token')
    if verify_token(token):
        return redirect('/')
    else:
        return redirect(login_config.get('login_url'))


@app.route('/realtime')
@auth._is_admin
@auth._is_authorized
def realtime(userid=None, **kwargs):
    return render_template('realtime.html')


@app.route('/faq')
@auth._is_authorized
def faq(userid=None):
    return render_template('faq.html')


@app.route('/acsmetric')
@auth._is_admin
@auth._is_authorized
def realtimedashboard(userid=None, **kwargs):
    if(users.getRole(userid) == 'Client'):
        return render_template('404.html'), 404
    return render_template('realtime_dashboard.html')


@app.route('/logout')
def Logout():
    return render_template('logout.html')


@app.route('/authorized')
def authorized():
    (session_uuid, token, email) = auth.handle_auth_uri_response(
        request.args.get('code'))
    resp = make_response(
        open('angular_flask/templates/authorized.html').read())
    expire_dt = datetime.datetime.now() + datetime.timedelta(hours=24)
    # resp.set_cookie('access_token', token)
    client_id = ('Rocket Recharge' if users.getAppname(email) == 'Juspay'
                 else users.getAppname(email)) if users.getAppname(email) else ''
    app.logger.info("User authorized: " + email)
    resp.set_cookie('session_uuid', session_uuid, expires=expire_dt)
    resp.set_cookie('email', email, expires=expire_dt)
    resp.set_cookie('role', users.getRole(email), expires=expire_dt)
    resp.set_cookie('client', client_id, expires=expire_dt)
    resp.set_cookie('timeFormat', users.getTimeformat(
        email), expires=expire_dt)
    resp.set_cookie('authtype', 'google', expires=expire_dt)
    return resp


@app.route('/customauth', methods=["POST"])
def customauth():
    data = json.loads(request.data)
    if data.get('success', None):
        token = data.get('token', None)
        email = data.get('email', None)
        session_uuid = str(uuid_lib.uuid4())
        resp = make_response(
            open('angular_flask/templates/authorized.html').read())
        cache.put('systemscope', session_uuid, str(
            time.time() + float(86400)), 86400)
        expire_dt = datetime.datetime.now() + datetime.timedelta(hours=24)
        resp.set_cookie('access_token', token)
        client_id = ('Juspay Demo' if users.getAppname(email) == 'Juspay'
                     else users.getAppname(email)) if users.getAppname(email) else ''
        app.logger.info("User authorized: " + email)
        cache.put('systemscope', session_uuid, str(
            time.time() + float(86400)), 86400)
        resp.set_cookie('authtype', data.get('type', None), expires=expire_dt)
        resp.set_cookie('session_uuid', session_uuid, expires=expire_dt)
        resp.set_cookie('email', email, expires=expire_dt)
        resp.set_cookie('role', users.getRole(email), expires=expire_dt)
        resp.set_cookie('client', client_id, expires=expire_dt)
        resp.set_cookie('timeFormat', users.getTimeformat(
            email), expires=expire_dt)
        return resp
    else:
        return render_template('404.html'), 404


@app.route('/loggedin', methods=['GET'])
def loggedin():
    data = json.loads(request.url.split('=')[1])
    if data.get('error', None) is False:
        token = data.get('token')
        deco_token = jwt.decode(token, login_config.get(
            'jwt_key'), options={'verify_iat': False})
        session_uuid = str(uuid_lib.uuid4())
        email = deco_token.get('username')
        resp = make_response(redirect(login_config.get('home_url')))
        cache.put('systemscope', session_uuid, str(
            time.time() + float(86400)), 86400)
        expire_dt = datetime.datetime.now() + datetime.timedelta(hours=24)
        resp.set_cookie('access_token', token)
        client_id = ('Juspay Demo' if users.getAppname(email) == 'Juspay'
                     else users.getAppname(email)) if users.getAppname(email) else ''
        app.logger.info("User authorized: " + email)
        cache.put('systemscope', session_uuid, str(
            time.time() + float(86400)), 86400)
        resp.set_cookie('authtype', 'customauth', expires=expire_dt)
        resp.set_cookie('session_uuid', session_uuid, expires=expire_dt)
        resp.set_cookie('email', email, expires=expire_dt)
        resp.set_cookie('role', users.getRole(email), expires=expire_dt)
        resp.set_cookie('client', client_id, expires=expire_dt)
        resp.set_cookie('timeFormat', users.getTimeformat(
            email), expires=expire_dt)
        return resp
    else:
        app.logger.info("Error authenticating " + str(request.url))
        return render_template('404.html'), 404


@app.route('/searchid')
@auth._is_authorized
def search(userid=None, **kwargs):
    # if(users.getRole(userid) == 'Client'):
    #     return render_template('403.html'), 403
    return render_template('searchid.html')


@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static'),
                               'img/favicon.ico')


@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html'), 404


@app.errorhandler(403)
def page_not_found(e):
    return render_template('403.html'), 404


@app.errorhandler(503)
def internal_err(e):
    return None, 503
