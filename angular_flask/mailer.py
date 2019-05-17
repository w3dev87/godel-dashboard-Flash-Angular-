from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from google.appengine.api import urlfetch
from google.appengine.runtime import DeadlineExceededError
import urllib
import hmac
import base64
import hashlib
from datetime import datetime
import logging

from login_config import aws_config 



def unlist(some_list):
    if isinstance(some_list,list):
        return ','.join(some_list)
    else:
        return some_list


def ses_multi_part( msg_to, msg_from='no-reply@juspay.in', msg_body='', msg_subject='', file_name=None, file_reader=None,
                      msg_html=None,msg_cc=None, msg_bcc=None,msg_type='plain', msg_reply_to='monitor@juspay.in'):
    """ send an html or plain e-mail. Use file_name and file_reader to pass an attachment
        inspiration: https://codeadict.wordpress.com/2010/02/11/send-e-mails-with-attachment-in-python/
    """

    msg = MIMEMultipart()
    msg.set_charset("utf-8")

    msg['Subject'] = msg_subject
    msg['From'] = msg_from
    msg['Reply-to'] = msg_reply_to
    msg['To'] = unlist(msg_to)
    # msg['To'] = 'rinil@juspay.in'

    if msg_cc:
        msg['Cc'] = unlist(msg_cc)
    else:
        msg['Cc'] = "ramanathan@juspay.in,boaz.john@juspay.in,rinil@juspay.in,dhinesh.radhakrishnan@juspay.in"
        # msg['Cc'] = 'boaz.john@juspay.in'
    if msg_bcc:
        msg['Bcc'] = unlist(msg_bcc)

    msg.preamble = 'Multipart massage.\n'

    part = MIMEText(msg_body, msg_type, "utf-8")
    msg.attach(part)
    if msg_html:
        part2= MIMEText(msg_html,'html')
        msg.attach(part2)

    if isinstance(file_name,list) and isinstance(file_reader,list):
        if len(file_name) == len(file_reader):
            for f_name in file_name:
                part = MIMEApplication(file_reader[file_name.index(f_name)])
                part.add_header('Content-Disposition', 'attachment', filename=f_name)
                msg.attach(part)
        else:
            logging.error('file name list and file list mismatch')

    elif isinstance(file_name,str) and isinstance(file_reader,str):
            part = MIMEApplication(file_reader)
            part.add_header('Content-Disposition', 'attachment', filename=file_name)
            msg.attach(part)


    SES(aws_config.get('AMAZON_ACCESS_KEY_ID'),aws_config.get('AMAZON_SECRET_ACCESS_KEY'),'monitor@juspay.in').sendRawEmail(msg.as_string())


class SES(object):
    """ SES send RAW e-mail
        inspiration: https://github.com/richieforeman/python-amazon-ses-api/blob/master/amazon_ses.py
    """

    def __init__(self, accessKeyID, secretAccessKey, return_path='contact@....'):

        self._accessKeyID = accessKeyID
        self._secretAccessKey = secretAccessKey
        self.ses_return_path = return_path

    def _getSignature(self, dateValue):

        h = hmac.new(key=self._secretAccessKey, msg=dateValue, digestmod=hashlib.sha256)
        return base64.b64encode(h.digest()).decode()

    def _getHeaders(self):

        headers = {'Content-type': 'application/x-www-form-urlencoded', 'Return-Path': self.ses_return_path}
        d = datetime.utcnow()
        dateValue = d.strftime('%a, %d %b %Y %H:%M:%S GMT')
        headers['Date'] = dateValue
        signature = self._getSignature(dateValue)
        headers['X-Amzn-Authorization'] = 'AWS3-HTTPS AWSAccessKeyId=%s, Algorithm=HMACSHA256, Signature=%s' % (self._accessKeyID, signature)
        return headers

    def _performAction(self, actionName, params=None):

        if not params:
            params = {}
        params['Action'] = actionName

        response = None
        #https://email.us-east-1.amazonaws.com/

        retry = 0  # download error retry
        while retry <= 1:  # dan een eenmalige retry
            try:
                url = 'https://email.eu-west-1.amazonaws.com'
                response = urlfetch.fetch(url=url, payload=urllib.urlencode(params), method=urlfetch.POST, headers=self._getHeaders())
                break
            except (urlfetch.DownloadError, DeadlineExceededError), e:
                logging.debug('Amazon SES download or deadline error : %d' % (retry + 1))
                if retry == 0:
                    retry += 1
                    continue  # retry
                else:
                    logging.warning('fetcherror' + str(e))
                    raise  # bij een dubbele fout stoppen

        if response.status_code != 200:
            logging.warning(response.headers)
            logging.warning(response.content)
            raise ValueError('status_code : %s' % (str(response.status_code)))

        logging.debug(response.content)
        return response.content

    def sendRawEmail(self, raw_msg_data):

        return self._performAction("SendRawEmail", params={"RawMessage.Data": base64.b64encode(raw_msg_data)})