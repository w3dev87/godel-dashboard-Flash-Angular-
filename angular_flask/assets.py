from flask.ext.compressor import FileAsset

# Packaging assets - CSS and JS

# Base JS for index
common_js = [FileAsset(filename='lib/bc/jquery/dist/jquery.min.js'),
             FileAsset(filename='lib/bootstrap.min.js'),
             FileAsset(filename='lib/bc/angular/angular.min.js'),
             FileAsset(filename='lib/bc/underscore/underscore-min.js'),
             FileAsset(filename='lib/bc/angular-route/angular-route.min.js'),
             FileAsset(filename='lib/bc/angular-resource/angular-resource.min.js'),
             FileAsset(filename='lib/bc/angular-bootstrap/ui-bootstrap-tpls.min.js'),
             FileAsset(filename='lib/bc/angular-sanitize/angular-sanitize.min.js'),
             FileAsset(filename='lib/bc/ng-csv/build/ng-csv.min.js'),
             FileAsset(filename='lib/bc/angular-google-chart/ng-google-chart.min.js'),
             FileAsset(filename='lib/bc/angular-dygraphs/src/angular-dygraphs.js'),
             FileAsset(filename='lib/bootbox.min.js'),
             FileAsset(filename='lib/graph/d3.v3.js'),
             FileAsset(filename='lib/graph/nv.d3.js'),
             FileAsset(filename='lib/bc/moment/moment.js'),
             FileAsset(filename='lib/bc/bootstrap-daterangepicker/daterangepicker.js'),
             FileAsset(filename='lib/scroll/angular-ui-tab-scroll.js'),
             FileAsset(filename='js/util.js'),
             FileAsset(filename='js/graph.js', processors=['jsmin']),
             FileAsset(filename='js/acuteSelect.js'),
             FileAsset(filename='js/app.js'),
             FileAsset(filename='js/services.js'),
             FileAsset(filename='js/controllers/mainCtrl.js'),
             FileAsset(filename='js/controllers/realtimeCtrl.js'),
             FileAsset(filename='js/directives.js'),
             FileAsset(filename='js/filters.js'),
             FileAsset(filename='js/datepicker.js')]

# Base CSS for index
common_css = [FileAsset(filename='css/bootstrap.min.css'),
              FileAsset(filename='css/nv.d3.css'),
              FileAsset(filename='lib/bc/bootstrap-daterangepicker/daterangepicker-bs3.css'),
              FileAsset(filename='css/angular-ui-tab-scroll.css'),
              FileAsset(filename='css/acuteSelect.css'),
              FileAsset(filename='css/main.css'),
              FileAsset(filename='css/login_opt.css'),]

# For admin panel and custom query
adm_css = [FileAsset(filename='css/bootstrap.min.css'),
           FileAsset(filename='css/angular-ui-tab-scroll.css'),
           FileAsset(filename='css/main.css')]

adm_js = [FileAsset(filename='lib/bc/jquery/dist/jquery.min.js'),
          FileAsset(filename='lib/bootstrap.min.js'),
          FileAsset(filename='lib/bc/underscore/underscore-min.js'),
          FileAsset(filename='lib/bc/angular/angular.min.js'),
          FileAsset(filename='lib/bc/angular-route/angular-route.min.js'),
          FileAsset(filename='lib/bc/angular-resource/angular-resource.min.js'),
          FileAsset(filename='lib/bc/angular-bootstrap/ui-bootstrap-tpls.min.js'),
          FileAsset(filename='lib/bc/angular-sanitize/angular-sanitize.min.js'),
          FileAsset(filename='lib/bc/ng-csv/build/ng-csv.min.js'),
          FileAsset(filename='lib/bc/angular-google-chart/ng-google-chart.min.js'),
          FileAsset(filename='lib/bc/angular-dygraphs/src/angular-dygraphs.js'),
          # FileAsset(filename='lib/bc/angular-google-dashboard-chart/ng-google-dashboard-chart.js'),
          FileAsset(filename='lib/scroll/angular-ui-tab-scroll.js'),
          FileAsset(filename='js/util.js'),
          FileAsset(filename='js/acuteSelect.js'),
          FileAsset(filename='js/app.js'),
          FileAsset(filename='js/services.js'),
          FileAsset(filename='js/controllers/mainCtrl.js'),
          FileAsset(filename='js/controllers/realtimeCtrl.js'),
          FileAsset(filename='js/directives.js')]






# For realtime and faq
faq_css = [FileAsset(filename='faq/css.css'),
           FileAsset(filename='faq/reset.css'),
           FileAsset(filename='faq/style.css')]

realtime_css = [FileAsset(filename='css/bootstrap-sandstone-custom.css'),
                FileAsset(filename='realtime/bootstrap.css'),
                FileAsset(filename='realtime/controlfrog.css'),
                FileAsset(filename='css/bootstrap-sandstone-custom.css'),
                FileAsset(filename='css/main.css')]

realtime_js = [FileAsset(filename='lib/bc/jquery/dist/jquery.min.js'),
               FileAsset(filename='js/controllers/mainCtrl.js'),
               FileAsset(filename='lib/bc/moment/moment.js'),
               FileAsset(filename='realtime/easypiechart.js'),
               FileAsset(filename='realtime/gauge.js'),
               FileAsset(filename='realtime/chart.js'),
               FileAsset(filename='realtime/jquery.js'),
               FileAsset(filename='realtime/bootstrap.js'),
               FileAsset(filename='realtime/controlfrog-plugins.js'),
               FileAsset(filename='lib/bc/angular/angular.js'),
               FileAsset(filename='lib/bc/angular-route/angular-route.js'),
               FileAsset(filename='lib/bc/angular-resource/angular-resource.js'),
               FileAsset(filename='lib/bc/angular-bootstrap/ui-bootstrap-tpls.js'),
               FileAsset(filename='realtime/controlfrog.js')]
