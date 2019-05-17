import sys
import math
# import authentication_statusistics
import json
import string
from angular_flask.hosting.services import users, email, query
from collections import defaultdict
from angular_flask import app
import logging
import datetime
import re
from itertools import groupby
from operator import itemgetter
import httplib2
from apiclient import discovery
from oauth2client import appengine
from data import app_name_map, merchant_dummyfy
from mailer import ses_multi_part


throwaway = datetime.datetime.strptime('20110101','%Y%m%d')

ALLOWED_CHARS = frozenset(string.ascii_letters + string.digits + "_" + "-")

def send_mail(msg_to, msg_from , msg_body='', msg_subject='', file_name=None, file_reader=None,\
                      msg_html=None,msg_cc=None, msg_bcc=None,msg_type='plain', msg_reply_to='monitor@juspay.in',via=None):
    if via and via == 'ses':
        ses_multi_part(msg_to, msg_from , msg_body, msg_subject, file_name, file_reader,\
                      msg_html,msg_cc, msg_bcc,msg_type, msg_reply_to)
    else:
        email.send_email(msg_to, msg_from , msg_body, msg_subject, file_name, file_reader,msg_html)


def map_back_merchant(merchant):
    for i in merchant_dummyfy:
        if i[0] == merchant:
            return i[1]
    return merchant

def is_pg(user_id):
    return users.getRole(user_id) in ['Pg']

def is_bank(user_id):
    return users.getRole(user_id) in ['Bank']

def squeeze(input_str):
    return " ".join(input_str.split())

def frcheck(inp_str):
    return all(c in ALLOWED_CHARS for c in inp_str)

def is_null_or_u(key, val):
    # print (key,val)
    # Is NULL fix; needs to pass both U and NULL for authentication_status if authentication_status=U is selected;
    if key == "authentication_status" and val == "U":
        return " (authentication_status IS NULL or authentication_status = \"U\")"
    elif val == "" or val == None or val == "null":
        return key + " IS NULL"
    elif type(val) == list and (val[0] == "" or val[0] == "null" or val[0] == None):
        return key + " IS NULL"
    else:
        if type(val) == list:
            return key + "=\"" + val[0] + "\""
        else:
            return key + "=\"" + val + "\""

# Apply filters
def do_filtered(filtered, filters,userid=None):
    if filters != None:
        f_str = "WHERE "
        for f in filters:
            if f.get("key"):
                if f.get("value") and type(f.get("value")) == list:
                    lst = f.get("value")
                    f_str += " ( "
                    for i in range(len(lst)):
                        if userid and (is_pg(userid) or is_bank(userid)) and f.get("key") == 'merchant_id':
                            lst[i] = map_back_merchant(lst[i])
                        if i != len(lst)-1:
                            # IS NULL fix
                            f_str += is_null_or_u(f.get("key"),lst[i]) + " OR "
                        else:
                            f_str += is_null_or_u(f.get("key"),lst[i]) + " ) AND "
                else:
                    value1 = f.get("value")
                    if userid and (is_pg(userid) or is_bank(userid)) and f.get("key") == 'merchant_id':
                        value1 = map_back_merchant(f.get("value"))
                    f_str += is_null_or_u(f.get("key"),value1) + " AND "

        #if userid and (is_pg(userid) or is_bank(userid)):
        #    print 'in filerrrrrrrrrrrrr'
        #    f_str=f_str.replace('merchant_id="others"','merchant_id NOT IN ("fcbrowser","nspi")')
        filtered = filtered.replace("WHERE",f_str)

    return filtered

def get_app_name(userid, params_id):
    if users.getAppname(userid) == "Juspay":
        return params_id
    return users.getAppname(userid)


def in_utc(userid):
    app.logger.info( 'user_id= '+str(userid))
    if users.getTimeformat(userid) in ['UTC',None]:
        app.logger.info( 'in_utc in_fun '+str(userid))
        return True
    app.logger.info( 'in_ist in_fun '+str(userid))
    return False

def prev_date(dt):
    return (datetime.datetime.strptime(dt, '%Y/%m/%d').date()-datetime.timedelta(days=1)).strftime('%Y/%m/%d')




# ===========================================================
#                    Drop-in' Alerts
# ===========================================================
class SimpleLinearRegression:
    """
    f(x) = a + b*x

    """
    def __init__(self, data):
        self.EPSILON = 0.0000001
        self.data = data   # list of (x,y) pairs
        self.a    = 0
        self.b    = 0
        self.r    = 0      # coefficient of correlation

    def run(self):
        """ Calculates coefficient of correlation and
            the parameters for the linear function """
        sumX, sumY, sumXY, sumXX, sumYY = 0, 0, 0, 0, 0
        n = float(len(self.data))

        for x, y in self.data:
            sumX  += x
            sumY  += y
            sumXY += x*y
            sumXX += x*x
            sumYY += y*y

        denominator = math.sqrt((sumXX - 1/n * sumX**2)*(sumYY - 1/n * sumY**2))
        if denominator < self.EPSILON:
            return False

        # coefficient of correlation
        self.r  = (sumXY - 1/n * sumX * sumY)
        self.r /= denominator

        # is there no relationship between "x" and "y"?
        if abs(self.r) < self.EPSILON:
            return False

        # calculating "a" and "b" of y = a + b*x
        self.b  = sumXY - sumX * sumY / n
        self.b /= (sumXX - sumX**2 / n)

        self.a  = sumY - self.b * sumX
        self.a /= n
        return True

    def function(self, x):
        """ linear function (be aware of current
            coefficient of correlation """
        return self.a + self.b * x

    def __repr__(self):
        """ current linear function for print """
        return "y = f(x) = %(a)f + %(b)f*x" % self.__dict__

def find_next_by_regression(data, varx):

    # print("Data: %s" % data)

    linRegr = SimpleLinearRegression(data)
    if not linRegr.run():
        app.logger.error("Error: failed to calculate parameters")
        return

    firstY = linRegr.function(data[0][0])
    lastY  = linRegr.function(data[-1][0])
    change = (lastY - firstY) / firstY * 100.0

    # print("Coefficient of correlation r = %f (r**2 is %f)" % (linRegr.r, linRegr.r**2))
    # print("Parameter a = %f" % linRegr.a)
    # print("Parameter b = %f" % linRegr.b)
    # print("Linear function is then %s" % linRegr)
    # print("Forecast of next value: f(%.2f) = %f" % (varx, linRegr.function(varx)))

    # # reducing of error rate (inverse valuation)
    # if change < 0:
    #     print("Trend: %.2f%% improvement" % -change)
    # else:
    #     print("Trend: %.2f%% drop" % change)

    return (round(linRegr.function(varx),2), -round(change,2))

def mean(data):
    n = len(data)
    if n < 1:
        raise ValueError("mean requires at least one data point")
    return sum(data)/n # in Python 2 use sum(data)/float(n)

def _sum_squares(data):
    c = mean(data)
    ss = sum((x-c)**2 for x in data)
    return ss

def stdev(data):
    n = len(data)
    if n < 2:
        raise ValueError("variance requires at least two data points")
    ss = _sum_squares(data)
    pvar = ss/n # the population variance
    return (pvar**0.5) * 100

# from random import randint
# data   = [(randint(1,30), randint(1,30)), (randint(1,30), randint(1,30)),(randint(1,30), randint(1,30)),(randint(1,30), randint(1,30))]
# find_next_by_regression(data, randint(1,30))

def alert_for_anomalies(resp, client_id, timestamp):
    report = defaultdict(lambda : defaultdict(dict))
    grouped = defaultdict(list)

    for item in resp['reports']:
        grouped[item['pid']].append(item)

    for item in grouped.keys():
        row = grouped.get(item)
        if row and len(row) > 1:
            reg_row = [(int(x.get('scount')), int(x.get('auth')), int(x.get('succ'))) for x in \
                        sorted(row, key=lambda z: z.get('dt')) if x.get('dt') not in ['1_day', '14_day'] \
                        and int(x.get('scount')) > 20]
            auth_data = [(x[0], x[1]) for x in reg_row if x[1] < x[0]]
            succ_data = [(x[0], x[2]) for x in reg_row if x[2] < x[0]]
            authenticated = [float(x[1])/float(x[0]) for x in reg_row if x[1] < x[0]]
            successful = [float(x[2])/float(x[0]) for x in reg_row if x[2] < x[0]]

            if len(authenticated) < 5 or len(successful) < 5:
                app.logger.error("Error. Need more datapoints. Can't computer for: " + item)
            else:
                auth_stdev = stdev(authenticated)
                succ_stdev = stdev(successful)


                day_data = [(int(x.get('scount')), int(x.get('auth')), int(x.get('succ'))) \
                                for x in row if x.get('dt') == '1_day']
                day_14_data = [(int(x.get('scount')), int(x.get('auth')), int(x.get('succ'))) \
                                for x in row if x.get('dt') == '14_day']
                # day_7_data = [(sum(x[0] for x in reg_row), sum(x[1] for x in reg_row), sum(x[2] for x in reg_row))]

                if len(day_data) != 0:
                    # predicted_auth = find_next_by_regression(auth_data, day_data[0][0])
                    predicted_succ = find_next_by_regression(succ_data, day_data[0][0])
                    # actual_auth = float(day_data[0][1])
                    actual_succ = float(day_data[0][2])
                    if predicted_succ and ((predicted_succ[0]/day_data[0][0] * 100) - (2 * succ_stdev)) > \
                            (actual_succ/day_data[0][0] * 100):
                        mean = float(day_14_data[0][2])/float(day_14_data[0][0]) * 100
                        if (mean - (mean * 0.05) > actual_succ/day_data[0][0] * 100) and \
                                (predicted_succ[0]/day_data[0][0] * 100) < 90:
                            report[client_id][item]['p_succ'] = predicted_succ[0]/day_data[0][0] * 100
                            report[client_id][item]['a_succ'] = actual_succ/day_data[0][0] * 100
                            report[client_id][item]['runat'] = timestamp
                            report[client_id][item]['stdev'] = succ_stdev
                            report[client_id][item]['trend'] = predicted_succ[1]
                            report[client_id][item]['mean'] = mean
                            report[client_id][item]['sum'] = day_data[0][0]
                    # Disabling authentication alerts
                    # elif predicted_auth and ((predicted_auth[0]/day_data[0][0] * 100) - (5 * auth_stdev)) > \
                    #         (actual_auth/day_data[0][0] * 100):
                    #     mean = float(day_14_data[0][1])/float(day_14_data[0][0]) * 100
                    #     if mean - (mean * 0.05) > actual_auth/day_data[0][0] * 100 and \
                    #             (predicted_auth[0]/day_data[0][0] * 100) < 90:
                    #         report[client_id][item]['p_auth'] = predicted_auth[0]/day_data[0][0] * 100
                    #         report[client_id][item]['a_auth'] = actual_auth/day_data[0][0] * 100
                    #         report[client_id][item]['runat'] = timestamp
                    #         report[client_id][item]['stdev'] = succ_stdev
                    #         report[client_id][item]['trend'] = predicted_auth[1]
                    #         report[client_id][item]['mean'] = mean
                    #         report[client_id][item]['sum'] = day_data[0][0]
                    else:
                        app.logger.info('No Alert: ' + item)

    # to, from, body, subject, attachment-name, attachment-file
    output_message = ""
    for app_name in report.keys():
        for pi in report[app_name].keys():
            if report[app_name][pi].get('sum') > 50:
                output_message += "Drop in performance: " + str(pi) + " for " + app_name + " on " + \
                                    str(report[app_name][pi].get('runat')) + '\n'
                # if 'p_auth' in report[app][pi].keys():
                #     output_message += "Predicted authentication success: " + str(round(report[app][pi].get('p_auth'))) + '%\n'
                #     output_message += "Actual authentication success: " + str(round(report[app][pi].get('a_auth'), 2)) + '%\n'
                #     output_message += "Average authentication success: " + str(round(report[app][pi].get('mean'), 2)) + '%\n'
                #     output_message += "Total sessions: " + str(report[app][pi].get('sum')) + '\n'
                #     output_message += "Standard deviation: " + str(round(report[app][pi].get('stdev'), 2)) + '\n'
                #     output_message += "General trend: " + ('+' if int(report[app][pi].get('trend')) > 0 else '') + \
                #                                             str(report[app][pi].get('trend')) + '\n\n'
                if 'p_succ' in report[app_name][pi].keys():
                    output_message += "Predicted success rate: " + str(round(report[app_name][pi].get('p_succ'))) + '%\n'
                    output_message += "Actual success rate: " + str(round(report[app_name][pi].get('a_succ'), 2)) + '%\n'
                    output_message += "Average success rate: " + str(round(report[app_name][pi].get('mean'), 2)) + '%\n'
                    output_message += "Total sessions: " + str(report[app_name][pi].get('sum')) + '\n'
                    output_message += "Standard deviation: " + str(round(report[app_name][pi].get('stdev'), 2)) + '\n'
                    output_message += "General trend: " + ('+' if int(report[app_name][pi].get('trend')) > 0 else '') + \
                                                            str(report[app_name][pi].get('trend')) + '\n\n'
    if len(output_message) > 0:
        app.logger.info(output_message)
        send_mail("godel@juspay.in", "monitor@juspay.in", output_message, "Godel Analytics: Alerts")
        return True
    else:
        app.logger.info('No Alerts for: ' + client_id)
        return False

def run_reports(resp, client_id, timestamp):
    send_mail("godel@juspay.in", "monitor@juspay.in", "PFA, report for " + client_id + " - " + timestamp, \
            "Godel Analytics: Reports", "report.csv", str(resp))
    return True

def alert_for_anomalies_pagemod(alerts):
    email_body = ""
    for alert in alerts:
        email_body += "Modify page error for " + str(alert.get('pi')) + ":\n Sessions with error: " + \
            str(alert.get('modify_page_errors')) + "\n Total sessions: " + str(alert.get('total_sessions')) + \
            " - Godel enabled sessions: " + str(alert.get('godel_true')) + "\n\n Event values: " + \
            ", ".join(alert.get('e_value') if alert.get('e_value') else []) + "\n\n"

    if len(email_body) > 0:
        app.logger.info(email_body)
        send_mail("godel@juspay.in", "monitor@juspay.in", email_body, "Godel Analytics: Alerts - Modify Page Error")
        return True
    else:
        app.logger.info('No Alerts for modify_page_err')
        return False


def convert2datatype(value, data_type):
    try:
        if(data_type == 'INTEGER'):
            return int(value)
        elif(data_type == 'FLOAT'):
            return float(value)
        else:
            return value
    except:
        return value

def getrows(row,threshold,column_map,column_name):
    for i,v in enumerate(column_name):
        index = column_map[v].get('index')
        data_type = column_map[v].get('data_type')
        if threshold[i] >= 0:
            if(convert2datatype(row['f'][index]['v'],data_type) >= threshold[i]):
                return True
        else:
            if(convert2datatype(row['f'][index]['v'],data_type) <= -threshold[i]):
                return True
    return False

def convert2csv(head,rows):
    str_csv = ' , '.join([str(i.get('name')) for i in head]) + '\n'
    for i in rows:
        row = []
        if i['f']:
            for j in i['f']:
                if j['v']:
                    row.append(j['v'])
                else:
                    row.append('None')
        str_csv += ' , '.join(row) + '\n'
    return str_csv


def createAlert(result, user_id):
    html = ""
    for i in result:
        response = query.execute(get_date_range(i.get('query')), "custom_query", user_id)
        # pp.pprint(response)
        # Alerts
        if i['job_type'] == 'Alert':
            app.logger.info('Checking for alerts: ' + str(i.get('key')))
            column_name = map(lambda x: x.strip(),i.get('column_name').split(","))
            threshold = map(lambda x: x.strip(),i.get('threshold').split(","))

            column_map = {}
            for index,val in enumerate(response['schema']['fields']):
                if val['name'] in column_name:
                    column_map[val['name']] = {'index':index,'data_type':val['type']}

            threshold = map(lambda (i,x): convert2datatype(x.strip(), column_map[column_name[i]]['data_type']), \
                            enumerate(i['threshold'].split(",")))
            alert = filter( lambda x: getrows(x,threshold,column_map,column_name),response['rows'])
            # html += groupAlerts(alert, response['schema']['fields'], i['column_name'], threshold, i['key'])
            html = groupAlerts(alert, response['schema']['fields'], i['column_name'], threshold, i['key'])
            csv = convert2csv(response['schema']['fields'],alert)
            if html:
                try:
                    app.logger.info(i['recipient'].split(','))
                    send_mail(i['recipient'].split(','), "monitor@juspay.in", "", "Godel Alert : " + i['key'], i['key']+".csv", csv, html,via='ses')
                except Exception as e:
                    app.logger.error(e)
                    app.logger.error('ERROR SENDING MAIL, Key:'+i['key'])

        # Reports
        elif i['job_type'] == 'Report':
            app.logger.info('Running reports: ' + str(i.get('key')))
            html = groupAlerts(response['rows'], response['schema']['fields'], i['column_name'], i['threshold'], i['key'])
            csv = convert2csv(response['schema']['fields'],response['rows'])
            if html:
                try:
                    app.logger.info(i['recipient'].split(','))
                    send_mail(i['recipient'].split(','), "monitor@juspay.in", "", "Juspay Report : " + i['key'], i['key']+".csv", csv, html,via='ses')
                except Exception as e:
                    app.logger.error(e)
                    app.logger.error('ERROR SENDING MAIL, Key:'+i['key'])

        # Call alert
        # Format rows as single line messages to be sent as subject
        # This will trigger call and tell the message.
        elif i['job_type'] == 'Callalert':
            app.logger.info('Running call alerts: '+ str(i.get('key')))
            column_name = map(lambda x: x.strip(),i.get('column_name').split(","))
            threshold = map(lambda x: x.strip(),i.get('threshold').split(","))
            column_map = {}
            for index,val in enumerate(response['schema']['fields']):
                if val['name'] in column_name:
                    column_map[val['name']] = {'index':index,'data_type':val['type']}

            threshold = map(lambda (i,x): convert2datatype(x.strip(), column_map[column_name[i]]['data_type']), \
                            enumerate(i['threshold'].split(",")))

            alert = filter( lambda x: getrows(x,threshold,column_map,column_name),response['rows'])

            messages = getAlertMessages(alert, response['schema']['fields'], i['column_name'], threshold, i['key'])

            app.logger.info(i['recipient'].split(','))

            for m in messages:
                try:
                    app.logger.info(m)
                    send_mail(i['recipient'].split(','), "monitor@juspay.in", "", m,via='ses')
                except Exception as e:
                    app.logger.error(e)
                    app.logger.error('ERROR SENDING MAIL, Key:'+i['key'])

"""
Method to form message string for call alerts.
"""
def getAlertMessages(alerts, schema, column_name, threshold, key):
    schema_name = []

    for i in schema:
        schema_name.append(i.get('name'))

    value_column_index = schema_name.index(column_name)

    messages = []

    for j in alerts:
        message = "Alert: "
        column_value = 0
        if j['f']:
            for index in range(len(j['f'])):
                if index == value_column_index:
                    column_value = j['f'][index]['v']
                else:
                    message += schema_name[index]+" "+str(j['f'][index]['v'])+", "
        message += "has "+column_name+" equal to "+str(column_value)
        messages.append(message)

    return messages



def groupAlerts(alert, schema, column_name, threshold, key):

    html = """<html>\
            <body>""" + \
            """<h3>Key: """ + key + """</h3> ( """ + column_name + """ ) --> ( """ + ', '.join(str(x) for x in threshold) + " ).<br><br>" + \
            """<div class="datagrid" style="font: normal 12px/150% Arial, Helvetica, sans-serif;background: #fff;\
            overflow: hidden;border: 1px solid #006699;-webkit-border-radius: 3px;-moz-border-radius: 3px;border-radius: 3px;">\
            <table style="border-collapse: collapse;text-align: left;width: 100%;">\
            <thead>\
            <tr>"""

    for i in schema:
        html += """<th style="padding: 3px 7px;background: -moz-linear-gradient( center top, #006699 5%, #00557F 100% );\
                    filter: progid:DXImageTransform.Microsoft.gradient(startColorstr='#006699', endColorstr='#00557F');\
                    background-color: #006699;color: #FFFFFF;font-size: 15px;font-weight: bold;\
                    border-left: 1px solid #0070A8;border: none;">""" + i.get('name') + "</th>"
    html += "</tr></thead><tbody>"

    alt = 1
    for i in alert:
        html += "<tr>"
        alt = 0 if alt else 1
        if alt:
            td = """<td style="padding: 3px 7px;color: #00496B;border-left: none;font-size: 12px;border-bottom: 1px \
                    solid #E1EEF4;font-weight: normal;">"""
        else:
            td = """<td style="padding: 3px 7px;color: #00496B;border-left: none;font-size: 12px;border-bottom: 1px \
                    solid #E1EEF4;font-weight: normal;background: #E1EEF4;">"""
        if i['f']:
            for j in i['f']:
                if j['v']:
                    html += td + j['v'] + "</td>"
                else:
                    html += td + "None" + "</td>"
        html += "</tr>"

    html += "</tbody></table></div></body></html><br><br><hr>"

    if len(alert) > 0:
        return html
    else:
        app.logger.info('No Alerts for ' + key)
        return ""

def alert_for_anomalies_coverage(alerts):
    email_body = ""
    if len(alerts) < 0:
        app.logger.info('No Alerts, empty content')
        return False
    for alert in alerts:
        email_body += "Godel coverage down for " + str(alert.get('type')) + ": " + \
            str(alert.get('alert').get(alert.get('type'))) + ":\n Current coverage: " + \
            str(alert.get('alert').get('godel_coverage')) + "%\n 14 day average: " + \
            str(alert.get('hist').get('godel_coverage')) + \
            "%\n Total sessions: " + str(alert.get('alert').get('total_sessions')) + \
            " - Godel enabled sessions: " + str(alert.get('alert').get('godel_true')) + "\n\n"

    if len(email_body) > 0:
        app.logger.info(email_body)
        send_mail("godel@juspay.in", "monitor@juspay.in", email_body, "Godel Analytics: Alerts - Godel Coverage")
        return True
    else:
        app.logger.info('No Alerts for godel coverage')
        return False

def get_date_range(query):
    if query and len(query) > 0:
        range_pattern = re.compile("`range\(([(\d+)day|today]+,[(\d+)day|today]+)\)`")
        ranges = re.findall(range_pattern, query)
        if len(ranges) > 0:
            for i in ranges:
                dt = i.split(",")
                date_range = '(TABLE_DATE_RANGE(godel_logs.godel_session, TIMESTAMP("' + str_to_date(dt[0]) + \
                '"),TIMESTAMP("' + str_to_date(dt[1]) + '")))'
                query = query.replace("`range(" + ",".join(dt) + ")`", date_range)
        if "`today`" in query:
            query = query.replace("`today`", str_to_date("today"))
        date_pattern = re.compile("`(\d+day)`")
        dates = re.findall(date_pattern, query)
        if len(dates) > 0:
            for d in dates:
                query = query.replace('`' + d + '`',  str_to_date(d))
    if query:
        return squeeze(query)
    return query


def str_to_date(date_string):
    today = datetime.datetime.now()
    date_pattern = re.compile("(\d+)day")
    if date_string == "today":
        return today.strftime("%Y/%m/%d")
    elif date_pattern.match(date_string):
        dt = date_pattern.match(date_string).group(1)
        return (today - datetime.timedelta(days=int(dt))).strftime("%Y/%m/%d")

def correct_recipient_format(recipient_list):
    recipient_list = recipient_list.split(",")
    for i in recipient_list:
        if ' ' in i.strip():
            return False
    return True

def check_date_length(start, end,userid):
    utc_default_time = "00:00:00"
    utc_default_time2 = "23:59:59"
    ist_default_time = "18:30:00"
    ist_default_time2 = "18:29:59"

    if len(start) > 11:
        if in_utc(userid):
            start_with_time = start
            end_with_time = end
            start = start[:10]
            end = end[:10]
        else:
            start_with_time =(datetime.datetime.strptime(start, '%Y/%m/%d_%H:%M:%S') \
                            - datetime.timedelta(minutes=330)).strftime('%Y/%m/%d_%H:%M:%S')
            end_with_time = (datetime.datetime.strptime(end, '%Y/%m/%d_%H:%M:%S') \
                            - datetime.timedelta(minutes=330)).strftime('%Y/%m/%d_%H:%M:%S')
            start = (datetime.datetime.strptime(start[:10], '%Y/%m/%d').date() \
                        - datetime.timedelta(days=1)).strftime('%Y/%m/%d')
            end = end[:10]
    else:
        if in_utc(userid):
            start_with_time = start + "_" + utc_default_time
            end_with_time = end + "_" + utc_default_time2
        else:
            start = (datetime.datetime.strptime(start[:10], '%Y/%m/%d').date() \
                        -datetime.timedelta(days=1)).strftime('%Y/%m/%d')
            start_with_time = start + "_" + ist_default_time
            end_with_time = end + "_" + ist_default_time2

    return start, end, start_with_time, end_with_time


def is_same_day(end,start):
    end_date = datetime.datetime.strptime(end, '%Y/%m/%d_%H:%M:%S')
    start_date  = datetime.datetime.strptime(start, '%Y/%m/%d_%H:%M:%S')
    if (end_date-start_date).total_seconds() < 86400:
        return True
    return False



allowed_fields = ['customer_email', 'screen_width', 'customer_phone_number', 'customer_id', 'bank',
    'stored_card', 'udf_type', 'network', 'godel_version', 'numpages', 'auth_method',
    'amount', 'os', 'payment_status', 'os_version', 'card_brand', 'screen_ppi',
    'app_version','payment_processor', 'brand', 'payment_instrument_group', 'payment_instrument', 'dropout_reasons',
    'latency', 'numscreens', 'model', 'network_type','merchant_id', 'run_date', 'run_week', 'run_month',
    'godel_build_version', 'screen_height', 'last_visited_url', 'card_token', 'payment_gateway','weblab',
    'aggregator', 'comparison', 'otp_auto_submitted','sim_operator']

def is_segment_valid(segment, userid):
    if users.getRole(userid) in ['Super', 'Admin', 'Juspay']:
        return segment
    else:
        segment_split = map(lambda x: x.strip(), segment.split(','))
        if len(segment_split) in [1,2] and all(x in allowed_fields for x in segment_split):
            return ', '.join(segment_split)
    return 'null'

def group_it(input_data, aggr_key, group_keys):
    grouper = itemgetter(*group_keys)
    result = []
    date_run = str(datetime.date.today())
    for key, grp in groupby(sorted(input_data, key = grouper), grouper):
        temp_dict = dict(zip(group_keys, key))
        temp_dict[aggr_key] = sum(item[aggr_key] for item in grp)
        temp_dict['date_run'] = date_run
        temp_dict['cost'] = ((((temp_dict[aggr_key] / 1024) /1024 / 1024) / 1024) *5)
        result.append(temp_dict)
    return result


def map_app(app_name):
    if ',' in app_name:
        app_name = "('" + app_name.replace(",","','") + "')"
        return "app_name IN " + app_name  + " AND "
    for i in app_name_map:
        if app_name in i:
            return "app_name IN " + str(i) + " and "
    return "app_name='" + app_name + "' and "

bank_icon_list = [{"code":"ALLBDC","name":"Allahabad Bank DC","url":"static/img/bankicon/juspay_allahabad.png"},
    {"code":"ALLBNB","name":"Allahabad Bank NB","url":"static/img/bankicon/juspay_allahabad.png"},
    {"code":"AMEXCC","name":"American Express CC","url":"static/img/bankicon/juspay_amex.png"},
    {"code":"ANDHDC","name":"Andhra Bank DC","url":"static/img/bankicon/juspay_andra.png"},
    {"code":"ANDHNB","name":"Allahabad Bank NB","url":"static/img/bankicon/juspay_andra.png"},
    {"code":"AXIS","name":"Axis Bank Card","url":"static/img/bankicon/juspay_axis.png"},
    {"code":"AXISNB","name":"Axis Bank NB","url":"static/img/bankicon/juspay_axis.png"},
    {"code":"BBKNB","name":"Bank of Bahrain and Kuwait NB","url":"static/img/bankicon/juspay_bbk.png"},
    {"code":"BOBDC","name":"Bank of Baroda DC","url":"static/img/bankicon/juspay_bob.png"},
    {"code":"BOBNB","name":"Bank of Baroda NB","url":"static/img/bankicon/juspay_bob.png"},
    {"code":"BOINB","name":"Bank of India NB","url":"static/img/bankicon/juspay_boi.png"},
    {"code":"BOMNB","name":"Bank of Maharashtra NB","url":"static/img/bankicon/juspay_bom.png"},
    {"code":"CANARA","name":"Canara Bank Card","url":"static/img/bankicon/juspay_canara.png"},
    {"code":"CANARANB","name":"Canara Bank NB","url":"static/img/bankicon/juspay_canara.png"},
    {"code":"CB CARD","name":"Central Bank of India Card","url":"static/img/bankicon/juspay_cent.png"},
    {"code":"CENTDC","name":"Central Bank of India DC","url":"static/img/bankicon/juspay_cent.png"},
    {"code":"CENTNB","name":"Central Bank of India NB","url":"static/img/bankicon/juspay_cent.png"},
    {"code":"CITI","name":"Citibank Card","url":"static/img/bankicon/juspay_citi.png"},
    {"code":"CITINB","name":"Citibank NB","url":"static/img/bankicon/juspay_citi.png"},
    {"code":"CITUDC","name":"City Union Bank DC","url":"static/img/bankicon/juspay_citu.png"},
    {"code":"CITUNB","name":"City Union Bank NB","url":"static/img/bankicon/juspay_citu.png"},
    {"code":"CORP CARD","name":"Corporation Bank Card","url":"static/img/bankicon/juspay_corp.png"},
    {"code":"CORPNB","name":"Corporation Bank NB","url":"static/img/bankicon/juspay_corp.png"},
    {"code":"COSMOS","name":"Cosmos Bank","url":"static/img/bankicon/juspay_cosmos.png"},
    {"code":"CSBNB","name":"Cosmos Bank NB","url":"static/img/bankicon/juspay_cosmos.png"},
    {"code":"DB CARD","name":"Deutsche Bank Card","url":"static/img/bankicon/juspay_db.png"},
    {"code":"DBNB","name":"Deutsche Bank NB","url":"static/img/bankicon/juspay_db.png"},
    {"code":"DBS","name":"DBS Bank","url":"static/img/bankicon/juspay_dbs.png"},
    {"code":"DBSNB","name":"DBS Bank NB","url":"static/img/bankicon/juspay_dbs.png"},
    {"code":"DCBNB","name":"DCB Bank NB","url":"static/img/bankicon/juspay_dcb.png"},
    {"code":"DENANB","name":"Dena Bank NB","url":"static/img/bankicon/juspay_dena.png"},
    {"code":"DENDC","name":"Dena Bank DC","url":"static/img/bankicon/juspay_dena.png"},
    {"code":"DHANNB","name":"Dhanlaxmi Bank NB","url":"static/img/bankicon/juspay_dhan.png"},
    {"code":"FEDDC","name":"Federal Bank DC","url":"static/img/bankicon/juspay_fed.png"},
    {"code":"FEDNB","name":"Federal Bank NB","url":"static/img/bankicon/juspay_fed.png"},
    {"code":"HDFC","name":"HDFC Bank Card","url":"static/img/bankicon/juspay_hdfc.png"},
    {"code":"HDFCNB","name":"HDFC Bank NB","url":"static/img/bankicon/juspay_hdfc.png"},
    {"code":"HSBC","name":"HSBC Bank","url":"static/img/bankicon/juspay_hsbc.png"},
    {"code":"ICICICC","name":"ICICI Bank CC","url":"static/img/bankicon/juspay_icici.png"},
    {"code":"ICICIDC","name":"ICICI Bank DC","url":"static/img/bankicon/juspay_icici.png"},
    {"code":"ICICINB","name":"ICICI Bank NB","url":"static/img/bankicon/juspay_icici.png"},
    {"code":"IDBIDC","name":"IDBI Bank DC","url":"static/img/bankicon/juspay_idbi.png"},
    {"code":"IDBINB","name":"IDBI Bank NB","url":"static/img/bankicon/juspay_idbi.png"},
    {"code":"INDDC","name":"Indian Bank DC","url":"static/img/bankicon/juspay_ind.png"},
    {"code":"INDNB","name":"Indian Bank NB","url":"static/img/bankicon/juspay_ind.png"},
    {"code":"INDUSCC","name":"IndusInd Bank CC","url":"static/img/bankicon/juspay_indusind.png"},
    {"code":"INDUSDC","name":"IndusInd Bank DC","url":"static/img/bankicon/juspay_indusind.png"},
    {"code":"INDUSNB","name":"IndusInd Bank NB","url":"static/img/bankicon/juspay_indusind.png"},
    {"code":"INGVYS","name":"ING Vysya Bank Card","url":"static/img/bankicon/juspay_ing.png"},
    {"code":"INGVYSNB","name":"ING Vysya Bank NB","url":"static/img/bankicon/juspay_ing.png"},
    {"code":"IOBDC","name":"Indian Overseas Bank DC","url":"static/img/bankicon/juspay_iob.png"},
    {"code":"IOBNB","name":"Indian Overseas Bank NB","url":"static/img/bankicon/juspay_iob.png"},
    {"code":"JKDC","name":"Jammu & Kashmir Bank DC","url":"static/img/bankicon/juspay_jk.png"},
    {"code":"JKNB","name":"Jammu & Kashmir Bank NB","url":"static/img/bankicon/juspay_jk.png"},
    {"code":"KASIKORN","name":"Kasikornbank","url":"static/img/bankicon/juspay_kasikorn.png"},
    {"code":"KBNB","name":"Karnataka Bank NB","url":"static/img/bankicon/juspay_kb.png"},
    {"code":"KOTAK","name":"Kotak Mahindra Bank Card","url":"static/img/bankicon/juspay_kotak.png"},
    {"code":"KOTAKNB","name":"Kotak Mahindra Bank NB","url":"static/img/bankicon/juspay_kotak.png"},
    {"code":"KTB BANK","name":"Karnataka Bank Card","url":"static/img/bankicon/juspay_kb.png"},
    {"code":"KVBDC","name":"Karur Vysya Bank DC","url":"static/img/bankicon/juspay_kvb.png"},
    {"code":"KVBNB","name":"Karur Vysya Bank NB","url":"static/img/bankicon/juspay_kvb.png"},
    {"code":"LVBDC","name":"Lakshmi Vilas Bank DC","url":"static/img/bankicon/juspay_lvb.png"},
    {"code":"LVBNB","name":"Lakshmi Vilas Bank NB","url":"static/img/bankicon/juspay_lvb.png"},
    {"code":"OBCDC","name":"Oriental Bank of Commerce DC","url":"static/img/bankicon/juspay_obc.png"},
    {"code":"OBCNB","name":"Oriental Bank of Commerce NB","url":"static/img/bankicon/juspay_obc.png"},
    {"code":"PayUMoney","name":"PayUMoney","url":"static/img/bankicon/juspay_PayUmoney.png"},
    {"code":"PNBDC","name":"Punjab National Bank DC","url":"static/img/bankicon/juspay_pnb.png"},
    {"code":"PNBNB","name":"Punjab National Bank NB","url":"static/img/bankicon/juspay_pnb.png"},
    {"code":"PSBNB","name":"Punjab & Sind Bank NB","url":"static/img/bankicon/juspay_psb.png"},
    {"code":"RBL CARD","name":"RBL Bank Card","url":"static/img/bankicon/juspay_rbl.png"},
    {"code":"RBLNB","name":"RBL Bank NB","url":"static/img/bankicon/juspay_rbl.png"},
    {"code":"RBS","name":"The Royal Bank of Scotland Card","url":"static/img/bankicon/juspay_rbs.png"},
    {"code":"RBSNB","name":"The Royal Bank of Scotland NB","url":"static/img/bankicon/juspay_rbs.png"},
    {"code":"RIYA","name":"Riyad Bank","url":"static/img/bankicon/juspay_riya.png"},
    {"code":"SARNB","name":"Saraswat Bank NB","url":"static/img/bankicon/juspay_sar.png"},
    {"code":"SBBJNB","name":"State Bank of Bikaner and Jaipur NB","url":"static/img/bankicon/juspay_sbbj.png"},
    {"code":"SBHNB","name":"State Bank of Hyderabad NB","url":"static/img/bankicon/juspay_sbh.png"},
    {"code":"SBIDC","name":"State Bank of India DC","url":"static/img/bankicon/juspay_sbi.png"},
    {"code":"SBINB","name":"State Bank of India NB","url":"static/img/bankicon/juspay_sbi.png"},
    {"code":"SBMNB","name":"State Bank Of Mysore NB","url":"static/img/bankicon/juspay_sbm.png"},
    {"code":"SBPNB","name":"State Bank of Patiala NB","url":"static/img/bankicon/juspay_sbp.png"},
    {"code":"SBTNB","name":"State Bank of Travancore NB","url":"static/img/bankicon/juspay_sbt.png"},
    {"code":"SCB","name":"Standard Chartered Bank Card","url":"static/img/bankicon/juspay_scb.png"},
    {"code":"SCBNB","name":"Standard Chartered Bank NB","url":"static/img/bankicon/juspay_scb.png"},
    {"code":"SIB CARD","name":"South Indian Bank Card","url":"static/img/bankicon/juspay_sib.png"},
    {"code":"SVCNB","name":"Shamrao Vithal Co-op. Bank NB","url":"static/img/bankicon/juspay_svc.png"},
    {"code":"SYNDC","name":"Syndicate Bank DC","url":"static/img/bankicon/juspay_syn.png"},
    {"code":"SYNNB","name":"Syndicate Bank NB","url":"static/img/bankicon/juspay_syn.png"},
    {"code":"TJSBDC","name":"TJSB Sahakari Bank DC","url":"static/img/bankicon/juspay_tjsb.png"},
    {"code":"TMBNB","name":"Tamilnad Mercantile Bank Limited NB","url":"static/img/bankicon/juspay_tmb.png"},
    {"code":"UBI CARD","name":"Union Bank of India Card","url":"static/img/bankicon/juspay_ub.png"},
    {"code":"UBNB","name":"Union Bank of India NB","url":"static/img/bankicon/juspay_ub.png"},
    {"code":"UCO","name":"UCO Bank Card","url":"static/img/bankicon/juspay_uco.png"},
    {"code":"UCONB","name":"UCO Bank NB","url":"static/img/bankicon/juspay_uco.png"},
    {"code":"UNBINB","name":"United Bank of India NB","url":"static/img/bankicon/juspay_unbi.png"},
    {"code":"VIJAYA","name":"Vijaya Bank Card","url":"static/img/bankicon/juspay_vijaya.png"},
    {"code":"VIJAYANB","name":"Vijaya Bank NB","url":"static/img/bankicon/juspay_vijaya.png"},
    {"code":"YESDC","name":"Yes Bank DC","url":"static/img/bankicon/juspay_yes.png"},
    {"code":"YESNB","name":"Yes Bank NB","url":"static/img/bankicon/juspay_yes.png"}]


# _SCOPE = 'https://www.googleapis.com/auth/bigquery'

# # Change the following 3 values:
# PROJECT_ID = 'godel-big-q'
# DATASET_ID = 'express_checkout_sessions'
# TABLE_ID = 'bill_it_up'


# body = {"rows":[
#     {"json": {"Col1":7,}}
# ]}

# credentials = appengine.AppAssertionCredentials(scope=_SCOPE)
# http = credentials.authorize(httplib2.Http())

# bigquery = discovery.build('bigquery', 'v2', http=http)
# response = bigquery.tabledata().insertAll(
#    projectId=PROJECT_ID,
#    datasetId=DATASET_ID,
#    tableId=TABLE_ID,
#    body=body).execute()

# print response
