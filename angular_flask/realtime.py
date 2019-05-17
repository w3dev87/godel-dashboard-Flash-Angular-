from angular_flask import app
from angular_flask.core import api
from angular_flask.core import *


from flask import Flask, request
from flask.ext import restful
from flask.ext.restful import fields, marshal_with, reqparse, Api, Resource, abort

import json
import datetime
from itertools import izip
from collections import defaultdict, OrderedDict, Callable
import string
import re

from boto import dynamodb
from boto.dynamodb.condition import BETWEEN


def dynamo_table():
	dynamoconn = dynamodb.connect_to_region('ap-southeast-1')
	table=dynamoconn.get_table('godel_sessions_dev')


def query_by_sid(session_id):
	#table.query(hash_key='a6ffb2e3-c511-4a69-a981-13c2f955999c').response
	return table.query(hash_key=session_id).response

def query_by_time(start, end):
	return table.scan(scan_filter={'created':BETWEEN(start,end)})

def success_rate_history(duration, interval, filter):

def session_count_history(duration, interval, filter):

def success_rate(interval, filter):

def drop_reasons(interval, filter):

def current_sessions(interval, filter):

