
Godel Dashboard
----------

#### Dependencies
* python-flask and dependencies (see requirements.txt)
* google-app-engine-sdk


#### Initial Local Install:
Setup lib directory
```
pip install -r requirements.txt -t $GODEL_DASHBOARD_CODE_DIR/angular_flask/lib
```
Download and configure Google App Engine SDK

`https://cloud.google.com/appengine/downloads`

Sublime Text 3 - Project Settings for Python and Angular.js

* Install Package Manager in ST3
* In `Preferences > Package Settings > Package Control > Settings - User`, add `"Anaconda"` and `"AngularJS"` in `installed_packages`
* Restart ST3

#### Local run
```
$APPENGINE_DIR/dev_appserver.py $GODEL_DASH_CODE_DIR
```

#### Remote Deployment
To Test stack:
```
$APPENGINE_DIR/appcfg.py update $GODEL_DASH_CODE_DIR -A juspay-analytics-test
```

To Prod stack:
```
$APPENGINE_DIR/appcfg.py update $GODEL_DASH_CODE_DIR -A juspay-analytics
```

