from google.appengine.api import mail
from ..services import Email

class Email(Email):
    def send_email(self, e_to, e_from, e_body, e_subject, e_att_name=None, e_att_file=None, e_html=None):
        message = mail.EmailMessage(sender=e_from, subject=e_subject)
        message.to = e_to
        message.body = e_body
        if e_html:
        	message.html = e_html
        if e_att_name and e_att_file:
            message.attachments = [(e_att_name, e_att_file)]
        message.send()
