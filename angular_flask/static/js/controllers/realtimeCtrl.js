'use strict';

/* Controllers */

function MetricCtrl($scope, $timeout, $http) {

    $scope.loading = false

    var poll = function() {
        $timeout(function() {
            $scope.loading = true
            $scope.run()
            $scope.run_live_stream()
            poll();
        }, 10000);
    };
    poll();


    $scope.run = function() {
        var Data = []
        $http.get('/acsmetrics').
        success(function(data, status, headers, config) {
            $scope.col1 = []
            $scope.rows1 = []
            $scope.col1 = data['columns']
            $scope.rows1 = data['rows']
            $scope.loading = false
        }).
        error(function(data, status, headers, config) {
            $scope.loading = false
        });
    }

    $scope.run()

    $scope.run_live_stream = function() {
        var Data = []
        $http.get('/livesessionstream').
        success(function(data, status, headers, config) {
            $scope.col2 = []
            $scope.rows2 = []
            $scope.col2 = data['columns']
            $scope.rows2 = data['rows']
            $scope.loading = false
        }).
        error(function(data, status, headers, config) {
            $scope.loading = false
        });
    }

    $scope.run_live_stream()

}

function getRealTimestamp (){
  var timeObj = []
  var newS = moment.utc().subtract(1,'hour').format("YYYY/MM/DD_HH:mm:ss")
  var newE = moment.utc().format("YYYY/MM/DD_HH:mm:ss")

    timeObj.push(newS)
    timeObj.push(newE)
    return timeObj
}

function RealLoginController($scope, $location, sharedDataService, role, $http) {
    $scope.parentobj = {};
    $scope.alerts = [];
    $scope.datalists = [];
    $scope.datalists = prefs;
    var state = getState()
    $scope.radioModel = state['toggle_state'] == "" || state['toggle_state'] == null ? 'Middle' : state['toggle_state']

    if (document.cookie.indexOf("uuid") < 0) {
        window.location = "/login"

    }

    role.getRole(function(data) {
        $scope.parentobj['role'] = data;
    });

    $scope.hide2 = true;
    var role = getCookie('role');
    if (['Super', 'Admin', 'Juspay'].indexOf(role) > -1) {
        $scope.hide2 = false;
        var params = {
            "email": getCookie('email')
        };
        var result = $http({
            url: '/users/getprefs',
            method: "POST",
            data: params,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getCookies()["access_token"]
            }
        }).
        success(function(data) {
            prefs = data.reverse()
        }).
        error(function(data, status) {
            $scope.login(status);
            return null;
        });
    }

    $scope.addAlert = function(errorMsg, ctrlType, stat) {
        $scope.alerts.push({
            type: 'info',
            msg: errorMsg,
            contrl: ctrlType,
            status: stat
        });
    };

    $scope.closeAlert = function(index) {
        $scope.alerts.splice(index, 1);
    };

    $scope.addition = function() {
        $scope.datalists = prefs;
    };

    $scope.suggest = function(site) {
        $scope.suggest = site;
    };

    $scope.$on('handleBroadcast', function(event, messages) {
        var call = null;
        var controllerType = messages.status;

        if (messages.hasOwnProperty('status')) {
            $scope.alerts = []
            if ($scope.parentobj[controllerType] === null || $scope.parentobj[controllerType] === 'null' || $scope.parentobj[controllerType] === undefined) {
                //Do Nothting
            } else {
                var statustype = String($scope.parentobj[controllerType]).split("")[0];
                if (String($scope.parentobj[controllerType]) === "403") {
                    // window.location = "/login_opt";
                    window.location = "/login"
                } else if (statustype === '4' || statustype === '5') {
                    $scope.addAlert("Unable to load data. Try reloading the page or click 'Update'. Error info: " + $scope.parentobj[controllerType], messages.status, $scope.parentobj[controllerType]);
                }
            }
        }
    });
}

function AdminController($scope, $http, sharedDataService) {
    $scope.parent = {}
    $scope.parent.role = "Client"
    $scope.parent.c = {}
    $scope.alerts = [];
    $scope.parent.user_email = "";

    $scope.login = function(status) {
        if (status == "403") {
            window.location = "/login";
        }
    };

    $scope.select_email = function() {
        $scope.parent.edit_email = $scope.parent.x;
    }

    $scope.add = function() {

        $scope.alerts = [];
        if ($scope.parent.email.split("@")[0] == '*') {
            $scope.parent.role = "Client"
        }
        var params = {
            "email": $scope.parent.email,
            "role": $scope.parent.role
        };
        var result = $http({
            url: '/users/adduser',
            method: "POST",
            data: params,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getCookies()["access_token"]
            }
        }).
        success(function(data) {
            if (data.result == "true") {
                if ($scope.parent.row) {
                    $scope.parent.row.push({
                        "email": $scope.parent.email,
                        "role": $scope.parent.role,
                        "appname": data.appname
                    });
                } else {
                    $scope.parent.row = [{
                        "email": $scope.parent.email,
                        "role": $scope.parent.role,
                        "appname": data.appname
                    }]
                }
                $scope.addAlert("Added  :  " + $scope.parent.email + " as " + $scope.parent.role);
            } else {
                $scope.addAlert("Duplicate");
            }
        }).
        error(function(data, status) {
            $scope.login(status);
            return null;
        });
    }

    $scope.edit = function() {
        if ($scope.parent.edit_email == undefined) {
            return null
        }

        $scope.alerts = [];
        if ($scope.parent.edit_email.split("@")[0] == '*') {
            $scope.parent.edit_role = "Client"
        }

        if ($scope.parent.edit_email == $scope.parent.user_email) {
            $scope.parent.edit_role = undefined;
        }

        if ($scope.parent.edit_appname == undefined) {
            $scope.parent.edit_appname = ""
        }

        if ($scope.parent.edit_timeformat == undefined) {
            $scope.parent.edit_timeformat = ""
        }

        if ($scope.parent.edit_role == undefined) {
            $scope.parent.edit_role = ""
        }

        var params = {
            "email": $scope.parent.edit_email,
            "role": $scope.parent.edit_role,
            "appname": $scope.parent.edit_appname,
            "timeformat": $scope.parent.edit_timeformat
        };
        var result = $http({
            url: '/users/edituser',
            method: "POST",
            data: params,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getCookies()["access_token"]
            }
        }).
        success(function(data) {
            if (data.result == "true") {
                for (var itr in $scope.parent.row) {
                    if ($scope.parent.row[itr]['email'] == $scope.parent.edit_email) {
                        $scope.parent.row[itr]['appname'] = data.appname
                        $scope.parent.row[itr]['role'] = data.role
                        $scope.parent.row[itr]['timeformat'] = data.timeformat
                    }
                }
                $scope.addAlert("Updated  :  " + $scope.parent.edit_email);
            } else {
                $scope.addAlert("Update Error");
            }
        }).
        error(function(data, status) {
            $scope.login(status);
            return null;
        });
    }

    $scope.del = function() {
        $scope.alerts = [];
        var arr = [];
        angular.forEach($scope.parent.c, function(selected, value) {
            if (selected) {
                arr.push(value);
            }
        });
        $scope.update(arr);
        $scope.parent.c = {}
    }


    $scope.update = function(delList) {
        var params = {
            "delList": delList
        };
        var result = $http({
            url: '/users/updateusers',
            method: "POST",
            data: params,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getCookies()["access_token"]
            }
        }).
        success(function(data) {
            var list = data.list;
            $scope.parent.row = data.value;
            $scope.parent.user_role = data.role;
            $scope.parent.user_email = data.email;

            if (list != undefined) {
                for (var index in list) {
                    for (var obj in $scope.parent.row) {
                        if ($scope.parent.row[obj]['email'] == list[index]) {
                            $scope.parent.row.splice(obj, 1);
                        }
                    }
                }
                for (var index in list)
                    $scope.addAlert("Deleted: " + list[index]);
            }
        }).
        error(function(data, status) {
            $scope.login(status);
            return null;
        });
    }

    $scope.addAlert = function(mssg) {
        $scope.alerts.push({
            type: 'info',
            msg: mssg
        });
    };

    $scope.closeAlert = function(index) {
        $scope.alerts.splice(index, 1);
    };

    $scope.update();
}

function RealFilterController($scope, $http, sharedDataService) {
    $scope.filter = defaultFilter;
    $scope.client = merchant;
    var times = getRealTimestamp();
    $scope.from = times[0];
    $scope.to = times[1];
    $scope.errors = false;
    $scope.filters = {};
    $scope.check = {};
    $scope.allDim = [];
    $scope.status = {};
    $scope.not_all = true;
    var role = getCookie('role');




    $scope.reset = function() {
        $scope.rows = {
            'merchant_payment_status': '',
            'aggregator': '',
            'payment_gateway': '',
            'godel_version': '',
            'authentication_status': '',
            'app_version': '',
            'wallet': '',
            'is_internal_device': '',
            'godel_remotes_version': '',
            'payment_instrument_group': '',
            'network': '',
            'payment_status': '',
            'payment_instrument': '',
            'is_godel': '',
            'auth_method': '',
            'weblab': '',
            'app_name': '',
            'experiments': '',
            'os': '',
            'log_level': '',
            'merchant_id': ''
        }
        for (var i in $scope.rows) {
            $scope.status[i] = {
                state: false,
                isLoaded: false,
                loader: true
            };
        }
    }

    $scope.reset();

    $scope.loadData = function(id, from, to, filter, dimensions, type) {
        var data = {
            "clientID": id,
            "from": from,
            "to": to,
            "filters": filter,
            "dimensions": dimensions,
            "where_clause": where,
            "is_realtime":true
        };
        var msgtemp = {};
        sharedDataService.loadData('/bq/filters', data, "", "", function(dataResponse, status) {
            for (var itr in $scope.rows) {
                if (dataResponse.hasOwnProperty(itr)) {
                    $scope.rows[itr] = dataResponse[itr];
                    $scope.status[itr].state = true;
                    $scope.status[itr].isLoaded = true;
                    $scope.status[itr].loader = true;
                }
            }
            var str_dim = "";
            var msgtemp = {};
            var seperator = "";
            for (var itr in $scope.rows) {
                if ($scope.status[itr].isLoaded) {
                    str_dim = str_dim + seperator + itr;
                    seperator = ",";
                }
            }

            var state = getState()
            state['dimension'] = str_dim;
            updateState(state)

            if (['Super', 'Admin', 'Juspay'].indexOf(role) > -1) {

                $scope.rowOrder = ['merchant_payment_status', 'payment_gateway', 'aggregator', 'wallet', 'is_internal_device',
                    'payment_status', 'authentication_status', 'payment_instrument', 'payment_instrument_group',
                    'network', 'godel_version', 'app_version', 'godel_remotes_version', 'is_godel', 'auth_method',
                    'weblab', 'app_name', 'os', 'experiments', 'log_level'
                ]
            } else if (['Client'].indexOf(role) > -1) {
                $scope.rowOrder = ['merchant_payment_status', 'payment_gateway', 'aggregator', 'wallet', 'payment_status',
                    'payment_instrument', 'payment_instrument_group', 'network', 'os', 'godel_version', 'app_version',
                    'app_name', 'auth_method', 'weblab', 'is_internal_device', 'log_level'
                ]
            } else if (['Bank'].indexOf(role) > -1) {
                $scope.rowOrder = ['network', 'os', 'payment_gateway', 'aggregator', 'wallet', 'payment_status',
                    'payment_instrument', 'payment_instrument_group', 'merchant_id'
                ]
            } else if (['Pg'].indexOf(role) > -1) {
                $scope.rowOrder = ['network', 'os', 'aggregator', 'wallet', 'payment_status', 'payment_instrument',
                    'payment_instrument_group', 'merchant_id'

                ]
            }

            if (id == 'All') {
                $scope.not_all = true
            } else {
                $scope.not_all = false
            }
            $('.extra').on("click", function(e) {
                var option = $(this).prop('checked');
                var siblings = $(this).siblings();
                var name;
                for (var i = 0; i < siblings.length; i++) {
                    name = $(siblings[i]).children().attr('id');
                    if (name in $scope.rowOrder) {
                        break;
                    }
                }
                var items = $('.' + name);
                if (option) {
                    for (var i = 0; i < items.length; i++) {
                        var j = $(items[i]);
                        if (j.prop('checked') === false) {
                            j.click();
                        }
                    }
                } else {
                    for (var i = 0; i < items.length; i++) {
                        var j = $($(items[i])[0]);
                        if (j.prop('checked') === true) {
                            j.click();
                        }
                    }
                }
            });
            // $scope.rowOrder = util.sortByOrder(_.keys(dataResponse),
            //     ['payment_status', 'authentication_status', 'payment_instrument', 'payment_instrument_group',
            //     'godel_version','network']);
            if (dataResponse === null || dataResponse === 'null') {
                $scope.errors = true;
                $scope.parentobj.ControllerFilter = status;
            } else {
                $scope.parentobj.ControllerFilter = "null";
                $scope.errors = false;
            }
            msgtemp['call'] = null;
            msgtemp['status'] = 'ControllerFilter';
            sharedDataService.prepForBroadcast(msgtemp);
        });
    }
    var state = getState()

    if (getCookie(getCookie('email')) < 0 || state['dimension'] == null || state['dimension'] == "") {
        $scope.loadData($scope.client, $scope.from, $scope.to, $scope.filter, [], "all")
    } else {
        $scope.loadData($scope.client, $scope.from, $scope.to, $scope.filter, [], "all")
        var dim_arr = state['dimension'].split(",")
        for (var index in dim_arr) {
            $scope.status[dim_arr[index]].loader = false;
        }
        $scope.loadData($scope.client, $scope.from, $scope.to, $scope.filter, dim_arr, "all")
    }

    $scope.applyFilters = function() {
        var msgtemp = {};
        var arr = [];
        angular.forEach($scope.filters, function(v, k) {
            arr.push({
                "key": k,
                "value": v
            })
        });
        try {
            where = $scope.user.where_text;
            if (where != null && where != "") {
                if (where.indexOf("and") != 0 && where.indexOf("or") != 0)
                    where = " and " + where
                else
                    where = " " + where
            }
        } catch (err) {
            where = "";
        }
        msgtemp['filter'] = arr;
        msgtemp['call'] = 'toggle';
        sharedDataService.prepForBroadcast(msgtemp);
    };

    $scope.$on('handleBroadcast', function(event, messages) {
        var call = null;
        if (messages.hasOwnProperty('call')) {
            call = messages.call;
        }
        if (call && (call === 'filter')) {
            if (messages.hasOwnProperty('dimensions')) {
                $scope.dimensions = messages.dimensions;
                $scope.allDim.push($scope.dimensions[0]);
            }
            $scope.loadData($scope.client, $scope.from, $scope.to, $scope.filter, $scope.dimensions, "one")
        }
        if (call && (call === 'all')) {
            if (messages.hasOwnProperty('client')) {
                $scope.client = messages.client;
            }
            if (messages.hasOwnProperty('date')) {
                $scope.from = messages.date.from;
                $scope.to = messages.date.to;

            }
            if (messages.hasOwnProperty('filter')) {
                $scope.filter = messages.filter;
            }
            if (messages.hasOwnProperty('filterFlush') && messages.filterFlush == true) {
                $scope.check = {}
                $scope.rows = {}
                $scope.status = {}
                $scope.reset();
                $scope.allDim = [];
            }
            $scope.loadData($scope.client, $scope.from, $scope.to, $scope.filter, $scope.allDim, "all")
        }
    });

    $scope.modifyFilter = function() {
        $scope.filters = {}
        angular.forEach($scope.check, function(selected, value) {
            if (selected) {
                var key = value.substr(0, value.indexOf("~"))
                var value = value.substr(value.indexOf("~") + 1, value.length)
                var arr = $scope.filters[key]
                if (arr) {
                    arr.push(value)
                } else {
                    arr = [value]
                }
                $scope.filters[key] = arr
            }
        });
        $scope.applyFilters();
        if ($scope.user && $scope.user.where_text && $scope.user.where_text != "") {
            var params = {
                "email": getCookie('email'),
                "string": $scope.user.where_text
            };
            var result = $http({
                url: '/users/storeprefs',
                method: "POST",
                data: params,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': getCookies()["access_token"]
                }
            }).
            success(function(data) {
                prefs = data.reverse()
            }).
            error(function(data, status) {
                $scope.login(status);
                return null;
            });
        }
    }

    $scope.clear = function() {
        if ($scope.user && $scope.user.where_text) {
            $scope.user.where_text = "";
        } else {
            $scope.user = {};
            $scope.user.where_text = "";
        }
        where = "";
        $scope.check = {}
        $scope.modifyFilter()
    }

    $scope.filterDim = function(key) {
        if ($scope.status[key].isLoaded) {
            return null
        }
        if (!$scope.status[key].isLoaded) {
            $scope.status[key].loader = false;
        }
        $scope.status[key].state = true;
        var msgtemp = {};
        msgtemp['dimensions'] = [key];
        msgtemp['call'] = 'filter';
        sharedDataService.prepForBroadcast(msgtemp);
    }

}


function RealClientsController($scope, $http, sharedDataService) {
    $scope.client = merchant
    var times = getRealTimestamp();
    $scope.from = times[0];
    $scope.to = times[1];
    $scope.prop = null;
    var role = getCookie('role')

    $scope.loadData = function(from, to) {
        var data = {
            "is_realtime":true,
            "from": from,
            "to": to,
        };
        var msgtemp = {};
        $scope.sortCase = function(a, b) {
            if (a.toLowerCase() > b.toLowerCase())
                return 1
            else if (a.toLowerCase() == b.toLowerCase())
                return 0
            else
                return -1
        };
        sharedDataService.loadData('/bq/clients', data, '', '', function(dataResponse, status) {
            $scope.rows = dataResponse;
            if ($scope.rows.client_id.length === 1) {
                $scope.hide = true
                $scope.prop = $scope.rows.client_id[0];
            } else {
                var arr = []
                for (var itr in $scope.rows['client_id']) {
                    arr[itr] = $scope.rows['client_id'][itr]['an']
                }
                $scope.rows['client_id'] = arr;
                $scope.hide = false;
                $scope.prop = getState().client || $scope.client;

            }
            if (['Super', 'Admin', 'Juspay'].indexOf(role) > -1) {
                $scope.rows['client_id'].unshift("All")
            }
            // $scope.rows['client_id'].sort($scope.sortCase)
            // $scope.parentobj.ControllerClients = status;
            msgtemp['status'] = 'ControllerClients';
            msgtemp['call'] = null;
            sharedDataService.prepForBroadcast(msgtemp);
        });
    };
    $scope.switchClient = function() {
        var state = getState()
        state['client'] = $scope.prop;
        state['dimension'] = "";
        updateState(state)
        var msgtemp = {};
        msgtemp['client'] = $scope.prop;
        msgtemp['filterFlush'] = true; // clearing the filter on client change
        msgtemp['reset'] = true;
        msgtemp['call'] = 'toggle';

        sharedDataService.prepForBroadcast(msgtemp);
    };
    $scope.loadData($scope.from, $scope.to);
    $scope.$on('handleBroadcast', function(event, messages) {
        var call = null;
        if (messages.hasOwnProperty('call')) {
            call = messages.call;
        }
        if (call && (call === 'all')) {
            if (messages.hasOwnProperty('date')) {
                $scope.from = messages.date.from;
                $scope.to = messages.date.to;
            }
            $scope.loadData($scope.from, $scope.to)
        }
    });


    $scope.filterByTime = function(fromTime, toTime) {
        var msgtemp = {};
        msgtemp['date'] = {
            "from": fromTime,
            "to": toTime
        };
        msgtemp['call'] = 'all';
        msgtemp['notCount'] = 'T';
        sharedDataService.prepForBroadcast(msgtemp);


    }

    $scope.dyRange = function() {
            var times = getRealTimestamp()


            $scope.filterByTime(times[0], times[1]);

        
    }

}

function RealGraphController($scope, $http, sharedDataService) {

    $scope.filter = defaultFilter
    $scope.client = merchant
    var times = getRealTimestamp();
    $scope.from = times[0];
    $scope.to = times[1];
    $scope.errors = false;
    $scope.show = false;


    $scope.loadData = function(id, from, to, filter, notCount) {
        $scope.show = false;
        if (notCount) {
            var notCount = notCount;
        } else {
            var notCount = 'F';
        }
        var state = getState();
        if (state['show_lines'] && typeof state['show_lines'] === 'object' && state['show_lines'].length === 7) {
            updateState(state);

        } else {
            state['show_lines'] = [true, true, true, false, false, false];
            updateState(state);

        }
        $scope.isChecked = state['show_lines'];
        var data = {
            "clientID": id,
            "from": from,
            "to": to,
            "filters": filter,
            "where_clause": where,
            "is_realtime": true
        };
        var msgtemp = {};
        sharedDataService.loadData('/bq/counts', data, 'countLoader', 'countTable', function(dataResponse, status) {
            $scope.rows = dataResponse;
            var formatted_resp = []
            var rowset = makerows($scope.rows);
            var csvrows = makecsv($scope.rows);
            doDygraph(csvrows, 'livedygraphs');
            $scope.rows = {
                counts: formatted_resp
            }

            if (dataResponse === null || dataResponse === 'null') {
                $scope.errors = true;
                // $scope.parentobj.ControllerCount = status;
            } else {
                // $scope.parentobj.ControllerCount = "null";
                $scope.errors = false;
                $scope.show = true;
                // $scope.chartObjects= donutpie();
                // $scope.chartObj = countChart();
                // $scope.updatePanel($scope.rows.counts, rowset, csvrows, notCount);
            }
            msgtemp['call'] = null;
            msgtemp['status'] = 'ControllerCount';
            sharedDataService.prepForBroadcast(msgtemp);
        });
    };
    // $scope.loadData('','','','','');
    $scope.loadData($scope.client, $scope.from, $scope.to, $scope.filter)
    // window.setInterval(function() {
    //     $scope.loadData($scope.client, $scope.from, $scope.to,  $scope.filter)
    // }, 30000);


    $scope.$on('handleBroadcast', function(event, messages) {
        var call = null;
        $scope.notCount = 'F'
        if (messages.hasOwnProperty('call')) {
            call = messages.call;
        }
        if (messages.hasOwnProperty('notCount')) {
            $scope.notCount = messages.notCount;
        }

        if (call && (call === 'all' || call === 'count')) {
            if (messages.hasOwnProperty('client')) {
                $scope.client = messages.client;
            }
            if (messages.hasOwnProperty('date')) {
                $scope.from = messages.date.from;
                $scope.to = messages.date.to;
            }
            if (messages.hasOwnProperty('filter')) {
                $scope.filter = messages.filter;
            }
            $scope.loadData($scope.client, $scope.from, $scope.to, $scope.filter, $scope.notCount)
        }
    });

    $scope.updatePanel = function(row, rowset, csvrows, notCount) {
        $scope.total_success = rowset[1];
        $scope.total_failure = rowset[2];
        $scope.total_sessions = $scope.total_success + $scope.total_failure;
        $scope.avg_success = parseInt($scope.total_success / $scope.total_sessions * 100);
        $scope.chartObjects = donutpie($scope.total_success, $scope.total_failure);
        if (notCount === 'F') {
            $scope.countChart = countChart(rowset[0]);
            doDygraph(csvrows, 'livedygraphs');
        }

    };
    $scope.changeviz = function(eve) {
        var state = getState();
        var eveId = eve.currentTarget.id;
        var eveChecked = eve.currentTarget.checked;
        state['show_lines'][eveId] = eveChecked;
        updateState(state)
        var state = getState();
        changevizof(eveId, eveChecked);

    }




}





function RealToggleController($scope, $http, sharedDataService) {

    $scope.filter = defaultFilter;
    $scope.isDisabledFor = false;
    $scope.to = to;

    var role = getCookie('role');

    if (['Bank'].indexOf(role) > -1) {
        $scope.isDisabledFor = true;
    }
    $scope.toggleSupported = function() {
        var state = getState();
        state['toggle_state'] = $scope.radioModel;
        updateState(state);
        var msgtemp = {};

        function getToggleState(toggleString) {
            if (new Date(state.to || $scope.to) > new Date('2016-06-02')) {

                var rtype = {
                    'Left': [],
                    'Middle': [{
                        "key": "coalesce(is_supported, payment_instrument_group)",
                        "value": ["T", "card", "netbanking", "credit card", "debit card"]
                    }],
                    'Right': [{
                        "key": "coalesce(is_supported, payment_instrument_group)",
                        "value": ["F", "unknown"]
                    }]
                };


            } else {
                var rtype = {
                    'Left': [],
                    'Middle': [{
                        "key": "payment_instrument_group",
                        "value": ["card", "netbanking", "credit card", "debit card"]
                    }],
                    'Right': [{
                        "key": "payment_instrument_group",
                        "value": "unknown"
                    }]
                };

            }
            return rtype[String(toggleString)] || rtype['Middle'];

        };
        msgtemp['filter'] = getToggleState($scope.radioModel);
        $scope.filter = getToggleState($scope.radioModel);
        msgtemp['call'] = 'all';
        msgtemp['client'] = $scope.client;
        msgtemp['reset'] = false;
        msgtemp['filterFlush'] = true;
        sharedDataService.prepForBroadcast(msgtemp);
    }

    $scope.$on('handleBroadcast', function(event, messages) {
        var call = null;
        if (messages.hasOwnProperty('call')) {
            call = messages.call;
        }
        if (call && call === 'toggle') {
            if (messages.hasOwnProperty('client')) {
                $scope.client = messages.client;
            }
            if (messages.hasOwnProperty('date')) {
                $scope.from = messages.date.from;
                $scope.to = messages.date.to;
            }
            if (messages.hasOwnProperty('reset') && messages.reset == true) {
                $scope.toggleSupported();
            }
            if (messages.hasOwnProperty('filter')) {
                var msgtemp = {};
                msgtemp['filter'] = $scope.filter.concat(messages.filter);
                msgtemp['call'] = 'all';
                msgtemp['client'] = $scope.client;
                sharedDataService.prepForBroadcast(msgtemp);
            }
        }

    });

}

function RealSegmentsController($scope, $http, sharedDataService, sortService, $q) {
    $scope.parent = {}
    $scope.client = merchant
    $scope.filter = defaultFilter
    var times = getRealTimestamp();
    $scope.from = times[0];
    $scope.to = times[1];
    $scope.errors = false;
    $scope.disable_sl = true;
    $scope.disable_sm = false;
    $scope.show = false;
    $scope.show_add_tab = false;
    $scope.isDisabledFor = false;
    $scope.show_table = true;
    $scope.contents = []
    $scope.text = "Export CSV "
    $scope.text2 = "Export Table "
    var limit = 10;
    var role = getCookie('role');
    var state = getState();

    if (['Bank', 'Pg'].indexOf(role) > -1) {

        $scope.isDisabledFor = true;
    }

    $scope.tabs = [];

    var tabsList = ['payment_instrument', 'merchant_id', 'payment_instrument_group', 'godel_version', 'payment_gateway', 'aggregator', 'network', 'app_version', 'payment_processor', 'weblab'];

    if (['Bank'].indexOf(role) > -1) {
        var tabsList = ['payment_instrument', 'merchant_id', 'brand',
            'payment_gateway', 'aggregator', 'network'
        ];
    }
    if (['Pg'].indexOf(role) > -1) {
        var tabsList = ['comparison', 'aggregator', 'payment_instrument_group', 'payment_instrument', 'network', 'os'];
    }
    $scope.setTabs = function() {
        if (state['tabs'] != null && state['tabs'].length > 0) {
            $scope.tabs = state['tabs'];
        } else {
            $scope.tabs = tabsList;
            if ($scope.client == 'All') {
                $scope.tabs.push('app_name');
            }
        }

        // if (['Super', 'Admin', 'Juspay'].indexOf(role) > -1) {
        //     // $scope.show = true;
        //     $scope.tabs.push('weblab');
        // }
        // else {
        //     $scope.show = false;
        // }
        // Allowing access to All Users
        $scope.show = true;
        $scope.tabs = unique($scope.tabs);
        var tabIndex = $scope.tabs.indexOf('+');
        if (tabIndex != -1) {
            $scope.tabs.splice(tabIndex, 1);
        }
        $scope.tabs.push('+');
    }

    $scope.active = function() {
        return $scope.tabs.filter(function(pane) {
            return pane.active;
        })[0];
    };

    function unique(arr) {
        var u = {},
            a = [];
        for (var i = 0, l = arr.length; i < l; ++i) {
            if (!u.hasOwnProperty(arr[i])) {
                a.push(arr[i]);
                u[arr[i]] = 1;
            }
        }
        return a;
    }

    $scope.setTabs();
    var new_field = null;
    $scope.dimension = $scope.tabs[0];

    $scope.switch = function() {
        new_field = $scope.newf;
        if (new_field == undefined || new_field == null || new_field.length == 0) {
            alert('New field cannot be empty!');
            return;
        }

        if (['Super', 'Admin', 'Juspay'].indexOf(role) > -1) {

            var fieldList = ['customer_email', 'screen_width', 'customer_phone_number', 'customer_id', 'bank',
                'stored_card', 'udf_type', 'network', 'godel_version', 'numpages', 'auth_method',
                'authentication_status', 'amount', 'os', 'payment_status', 'os_version', 'card_brand',
                'screen_ppi', 'app_version', 'payment_processor', 'brand', 'payment_instrument_group',
                'payment_instrument', 'dropout_reasons', 'godel_remotes_version', 'latency',
                'numscreens', 'model', 'network_type', 'godel_build_version', 'screen_height',
                'last_visited_url', 'card_token', 'payment_gateway', 'aggregator', 'experiments'
            ]
        } else if (['Client'].indexOf(role) > -1) {
            var fieldList = ['customer_email', 'screen_width', 'customer_phone_number', 'customer_id', 'bank',
                'stored_card', 'udf_type', 'network', 'numpages', 'auth_method',
                'amount', 'os', 'payment_status', 'os_version', 'card_brand', 'screen_ppi',
                'app_version', 'payment_processor', 'brand', 'payment_instrument_group',
                'payment_instrument', 'dropout_reasons', 'latency', 'numscreens', 'model',
                'network_type', 'screen_height', 'last_visited_url', 'card_token', 'payment_gateway',
                'aggregator', 'weblab', 'merchant_id', 'otp_auto_submitted'
            ]
        } else if (['Bank', 'Pg'].indexOf(role) > -1) {
            var fieldList = ['network', 'auth_method', 'os', 'card_brand', 'brand', 'payment_instrument', 'latency',
                'network_type', 'payment_gateway', 'aggregator', 'merchant_id', 'comparison'
            ]
        }

        var segmentsList = new_field.split(",");

        if (segmentsList.length > 2) {
            $scope.addAlert("Invalid format. Please use field1, field2. Maximum number of allowed fields is 2.");
            return;
        }
        if (segmentsList.length == 2) {
            new_field = segmentsList[0].split(" ").join("") + ', ' + segmentsList[1].split(" ").join("");
        }

        if ($scope.tabs.indexOf(new_field) != -1) {
            $scope.addAlert("Duplicate. Segment is already added.");
            return;
        }

        if (['Super', 'Admin', 'Juspay'].indexOf(role) < 0) {
            for (var j in segmentsList) {
                if (fieldList.indexOf(segmentsList[j].split(" ").join("")) == -1) {
                    $scope.addAlert("Invalid segment. The fields specified doesn't match the schema.");
                    return;
                }
            }
        }


        $scope.tabs.splice($scope.tabs.indexOf('+'), 1);
        $scope.tabs.push(new_field);
        $scope.tabs.push('+');
        $scope.newf = "";
        state['tabs'] = $scope.tabs;
        updateState(state);

    }

    $scope.delTab = function(del_key) {
        var index = $scope.tabs.indexOf(del_key);
        $scope.tabs.splice(index, 1);
        state = getState()
        state['tabs'] = $scope.tabs;
        updateState(state)
        if (del_key == $scope.dimension)
            $scope.changeTab($scope.tabs[index % $scope.tabs.length])
    }
    $scope.filter_out = function(_searchWord) {
        $scope.contents = _searchWord.split(' ')
    }

    $scope.check_presence = function(value) {
        return function(val) {
            if ($scope.contents.length == 0 || $scope.contents[0].length == 0)
                return true;
            var str1 = angular.lowercase(val.value),
                str2 = "";
            for (var content in $scope.contents) {
                if ($scope.contents[content] == "")
                    continue;
                str2 = angular.lowercase($scope.contents[content]);
                if (str1.indexOf(str2) > -1)
                    return true;
            }
            return false;
        }
    }

    $scope.loadData = function(id, from, to, filter) {
        state = getState();
        state['tabs'] = $scope.tabs;
        updateState(state)
        var data = {
            "clientID": id,
            "from": from,
            "to": to,
            "filters": filter,
            "dimension": $scope.dimension,
            "where_clause": where,
            "is_realtime": true

        };
        var msgtemp = {};

        $scope.sortNumber = function(a, b) {
            return a - b;
        }

        sharedDataService.loadData('/bq/segments', data, 'segmentLoader', 'segmentTable', function(dataResponse, status) {
            $scope.rows = dataResponse;
            $scope.disable_sm = false;
            $scope.disable_sl = true;
            $scope.limit = limit;
            $scope.text = "Export CSV"
            $scope.disable = false
            if (dataResponse === null || dataResponse === 'null') {
                // $scope.parentobj.ControllerSegments = status;
                $scope.errors = true;
            } else {
                // $scope.parentobj.ControllerSegments = 'null';
                $scope.errors = false;

                // $scope.tabs = util.sortByOrder(_.keys(dataResponse),['payment_instrument', 'network']);
                // $scope.tabs = ['payment_instrument', 'payment_instrument_group', 'godel_version', 'network', 'app_version'];
                $scope.setTabs();

                for (var header in $scope.rows) {
                    var multiSegmentPattern = /concat\((.*)\)/;
                    if (multiSegmentPattern.test(header)) {
                        var newHeader = multiSegmentPattern.exec(header)[1];
                        $scope.rows[newHeader] = $scope.rows[header];
                        delete $scope.rows[header];
                        header = newHeader;
                    }
                    for (var data in $scope.rows[header]) {
                        $scope.rows[header][data].a_succ_rate = $scope.rows[header][data].auth_y / $scope.rows[header][data].t_count * 100;
                        $scope.rows[header][data].p_succ_rate = $scope.rows[header][data].pay_s / $scope.rows[header][data].t_count * 100;
                        $scope.rows[header][data].mp_succ_rate = $scope.rows[header][data].mpay_s / $scope.rows[header][data].t_count * 100;
                        $scope.rows[header][data].is_godel_succ_rate = $scope.rows[header][data].is_godel / $scope.rows[header][data].t_count * 100;
                        $scope.rows[header][data].p_succ_rate7 = $scope.rows[header][data].pay_s7 / $scope.rows[header][data].t_count7 * 100;
                        $scope.rows[header][data].p_succ_rate14 = $scope.rows[header][data].pay_s14 / $scope.rows[header][data].t_count14 * 100;
                        $scope.rows[header][data].volume_perc = $scope.rows[header][data].t_count / $scope.rows[header][data].sess_count * 100;

                        var temp = $scope.rows[header][data].dropout_res;
                        if (temp != null) {
                            $scope.rows[header][data].max = temp.split("(")[0];
                            if ($scope.rows[header][data].max == 'NULL' && temp.split(",").length > 1) {
                                $scope.rows[header][data].max = temp.split(",")[1].split("(")[0];
                            }
                            $scope.rows[header][data].dropout_res = $scope.rows[header][data].dropout_res.split(",");
                            for (var itr in $scope.rows[header][data].dropout_res) {
                                var i = +$scope.rows[header][data].dropout_res[itr].split("(")[1].split(")")[0];
                                i = Math.round(i / ($scope.rows[header][data].t_count - $scope.rows[header][data].pay_s) * 100);
                                $scope.rows[header][data].dropout_res[itr] = $scope.rows[header][data].dropout_res[itr].split("(")[0] + " (" + String(i) + "%)";
                            }
                            $scope.rows[header][data].dropout_res = $scope.rows[header][data].dropout_res.slice(0, 10);
                            $scope.rows[header][data].dropout_res = $scope.rows[header][data].dropout_res.toString().replace(/,/g, "<br>");
                        } else {
                            $scope.rows[header][data].max = "null";
                        }
                    }
                }

                $scope.len = $scope.rows[$scope.dimension].length
                if ($scope.len < limit) {
                    $scope.disable_sl = true;
                    $scope.disable_sm = true;
                }
            }
            msgtemp['status'] = 'ControllerSegments';
            msgtemp['call'] = null;
            sharedDataService.prepForBroadcast(msgtemp);
        }


        );
    }

    

    $scope.sort = {
        column: 't_count',
        descending: 'true'
    };

    $scope.downloadTable = function() {
        var result = {}
        arr = []

        function percFormat(num) {
            x = Math.floor(num * 100) / 100;
            return (x.toFixed(2)) + '%';
        }



        for (var itr in $scope.rows) {
            for (var i in $scope.rows[itr]) {
                $scope.tab_name = itr;
                var obj = {
                    "segment": $scope.rows[itr][i].value,
                    "total": $scope.rows[itr][i].t_count,
                    "volume_%": percFormat($scope.rows[itr][i].volume_perc),
                    "tp50": $scope.rows[itr][i].latency_tp50 + 'ms',
                    "godel": percFormat($scope.rows[itr][i].is_godel_succ_rate),
                    "a_succ_rate": percFormat($scope.rows[itr][i].a_succ_rate),
                    "success": $scope.rows[itr][i].pay_s,
                    "faliure": $scope.rows[itr][i].pay_f,
                    "unknown": $scope.rows[itr][i].pay_u,
                    "last_7": percFormat($scope.rows[itr][i].p_succ_rate7),
                    "last_14": percFormat($scope.rows[itr][i].p_succ_rate14),
                    "success_rate": percFormat($scope.rows[itr][i].p_succ_rate),
                    "merchant_success_rate": percFormat($scope.rows[itr][i].mp_succ_rate),
                    "top_dropout": $scope.rows[itr][i].max,
                    "all_dropouts": ($scope.rows[itr][i].dropout_res || 'null').replace(/<br>/g, ";")
                }
                arr.push(obj)
            }
        }
        // $scope.disable2 = false
        $scope.text2 = "Export Table "
        $scope.disable2 = false


        return arr.sort(sortObj2)

        function sortObj2(a, b) {
            if (a['total'] < b['total'])
                return 1
            else if (a['total'] == b['total'])
                return 0
            else
                return -1
        }


    }



    $scope.TableHeaderJson = function() {
        return [$scope.tab_name, "Total", "Volume_%", "TP50", "Godel", "Auth_Success_Rate",
            "Success", "Faliure", "Unknown", "Merchant_Success", "Merchant_Faliure", "Unknowns", "Last_7_Days", "Last_14_Days", "Success_Rate", "Merchant_Payment_Status", "Top_Dropout", "All_Dropouts"
        ]
    }


    $scope.downloadView = function() {
        $scope.text2 = "Downloading ..."
        $scope.disable2 = false
        return $scope.downloadTable()

    }

    $scope.showMore = function() {
        if ($scope.limit == limit) {
            $scope.limit = 'Infinity';
            $scope.disable_sl = false;
            $scope.disable_sm = true;
        }
    }

    $scope.showLess = function() {
        if ($scope.limit == 'Infinity') {
            $scope.limit = limit;
            $scope.disable_sm = false;
            $scope.disable_sl = true;
        }
    }


    $scope.downloadCsv = function() {
        var arr = []
        var filterData = [];
        $scope.tab_name = ''
        for (var itr in $scope.rows) {
            $scope.tab_name = itr
            for (var i in $scope.rows[itr]) {
                arr.push($scope.rows[itr][i].value)
            }
        }
        angular.copy($scope.filter, filterData)
        filterData.push({
            'key': itr,
            'value': arr
        })

        var data = {
            "clientID": $scope.client,
            "from": $scope.from,
            "to": $scope.to,
            "filters": filterData,
            "tab": $scope.tab_name
        };
        var msgtemp = {};

        var deferred = $q.defer();

        function format(rows) {
            arr = []
            angular.forEach(rows, function(v) {
                var result = {}
                result[$scope.tab_name] = v[0][$scope.tab_name]
                var obj = {
                    "session_id": v[0].sid,
                    "txn_id": v[0].txn_id,
                    "order_id": v[0].order_id,
                    "authentication_status": v[0].auth_stat,
                    "payment_status": v[0].pstat,
                    "network": v[0].net,
                    "avg_latency": v[0].avglat,
                    "auth_method": v[0].auth,
                    "timestamp": v[0].stime,
                    "godel_status": v[0].godel,
                    "dropout_reasons": v[0].dropout_reasons,
                    "email": v[0].email,
                    "phone": v[0].phone
                }
                $.extend(result, obj)
                arr.push(result)
            });
            return arr
        }

        function sortObj(a, b) {
            if (a[$scope.tab_name] + a['timestamp'] > b[$scope.tab_name] + b['timestamp'])
                return 1
            else if (a[$scope.tab_name] + a['timestamp'] == b[$scope.tab_name] + b['timestamp'])
                return 0
            else
                return -1
        }

        setTimeout(
            sharedDataService.loadData('/bq/csvsessions', data, '', '', function(dataResponse, status) {
                $scope.csv_rows = dataResponse;
                if (dataResponse === null || dataResponse === 'null') {
                    $scope.text = "File too big to download"
                    $scope.disable = true
                    $scope.parentobj.ControllerSession = status;
                    deferred.reject(null)
                } else {
                    $scope.parentobj.ControllerSession = 'null';
                    var csv_data = format($scope.csv_rows)
                    deferred.resolve(csv_data)
                }

                msgtemp['status'] = 'ControllerSession';
                msgtemp['call'] = null;
                sharedDataService.prepForBroadcast(msgtemp);
            }), 1000);

        return deferred.promise.then(function(result) {
            // this is only run after $http completes
            result = result.sort(sortObj)
            $scope.text = "Export CSV"
            $scope.disable = false
            return result
        });
    }

    $scope.startDownload = function() {
        $scope.text = "Downloading ..."
        $scope.disable = false
        return $scope.downloadCsv()
    }

    $scope.headerJson = function() {
        return [$scope.tab_name, "session_id", "txn_id", "order_id", "authentication_status", "payment_status", "network", "avg_latency",
            "auth_method", "timestamp", "godel_status", "dropout_reasons", "email", "phone"
        ]
    }

    $scope.changeSorting = function(column) {
        sortService.changeSorting($scope.sort, column);
    }

    $scope.selectedCls = function(column) {
        return sortService.selectedCls($scope.sort, column);
    }

    $scope.getSessions = function(ft, ty, val) {
        var msgtemp = {};
        if (val == ' NULL') {
            val = null
        } else if (val == "unknown" && ty != "payment_instrument_group") {
            val = null
        }
        if (ty == "payment_instrument" && val == "BEFORE_BANK") {
            ty = "dropout_reasons"
        }
        msgtemp['session'] = {
            "value": ft,
            "stype": ty,
            "sval": val
        };
        msgtemp['call'] = 'session';
        msgtemp['client'] = $scope.client;
        msgtemp['filter'] = $scope.filter
        msgtemp['date'] = {
            "from": $scope.from,
            "to": $scope.to
        }
        sharedDataService.prepForBroadcast(msgtemp);
    }

    $scope.getSegmentCount = function(ft, ty, val) {
        var msgtemp = {};
        if (val == ' NULL') {
            val = null
        } else if (val == "unknown" && ty != "payment_instrument_group") {
            val = null
        }
        if (ty == "payment_instrument" && val == "BEFORE_BANK") {
            ty = "dropout_reasons"
        }
        msgtemp['segmentMetric'] = {
            "value": ft,
            "stype": ty,
            "sval": val
        };
        msgtemp['call'] = 'segmentMetric';
        msgtemp['client'] = $scope.client;
        msgtemp['filter'] = $scope.filter
        sharedDataService.prepForBroadcast(msgtemp);
    }

    $scope.loadData($scope.client, $scope.from, $scope.to, $scope.filter);

    $scope.changeTab = function(tab_name) {
        if (tab_name === '+') {
            if ($scope.show_add_tab == true)
                return;
            $scope.show_add_tab = !$scope.show_add_tab;
            $scope.show_table = false;
            return;
        } else
            $scope.show_add_tab = false;
        $scope.dimension = tab_name;
        $scope.show_table = true;
        $scope.errors = false;
        $scope.contents = [];
        $scope.loadData($scope.client, $scope.from, $scope.to, $scope.filter);
    }



    // window.setInterval(function() {
    //     $scope.loadData($scope.client, '', '', $scope.filter)
    // }, 30000);
    $scope.$on('handleBroadcast', function(event, messages) {
        var call = null;
        if (messages.hasOwnProperty('call')) {
            call = messages.call;
        }
        if (call && (call === 'all' || call === 'segment')) {
            if (messages.hasOwnProperty('client')) {
                $scope.client = messages.client;
            }
            if (messages.hasOwnProperty('date')) {
                $scope.from = messages.date.from;
                $scope.to = messages.date.to;
            }
            if (messages.hasOwnProperty('filter')) {
                $scope.filter = messages.filter;
            }
            $scope.loadData($scope.client, $scope.from, $scope.to, $scope.filter)
        }
    });
}


function FunnelControllerRealtime($scope, $http, sharedDataService) {
    $scope.filter = defaultFilter
    $scope.client = merchant
    var times = getRealTimestamp();
    $scope.from = times[0];
    $scope.to = times[1];
    $scope.errors = false;
    $scope.hide = true;
    $scope.funnelResult = "";
    $scope.sankeyHide = true;


    var storerow = {};

    $scope.createFunnel = function(pi) {
        $scope.errors = false;
        $scope.sankeyHide = true;
        var data = {
            "clientID": $scope.client,
            "from": $scope.from,
            "to": $scope.to,
            "filters": $scope.filter,
            "where_clause": where,
            "pi": pi,
            "is_realtime": true
        };
        var msgtemp = {};
        sharedDataService.loadData('/bq/funnel_data', data, 'funnelLoader', 'funnelTable', function(dataResponse, status) {
            removeSankey();
            $scope.sankeyHide = false;
            if (dataResponse === null || dataResponse === 'null') {
                $scope.errors = true;
                $scope.sankeyHide = false;
                // $scope.parentobj.ControllerFunnnel = status;
            } else {
                if (dataResponse.length == 4) {
                    $scope.errors = true;
                } else {
                    $scope.errors = false;
                    $scope.funnelResult = dataResponse;
                    makeSankey($scope.funnelResult);
                }
                $scope.sankeyHide = false;
                // $scope.parentobj.ControllerFunnnel = 'null';
            }
            msgtemp['status'] = 'ControllerFunnnel';
            msgtemp['call'] = null;
            sharedDataService.prepForBroadcast(msgtemp);

        });
    };

    $scope.loadData = function(id, from, to, filter) {
        var data = {
            "clientID": id,
            "from": $scope.from,
            "to": $scope.to,
            "filters": filter,
            "where_clause": where,
            "is_realtime": true
        };
        var msgtemp = {};
        sharedDataService.loadData('/bq/funnels', data, 'funnelLoader', 'funnelTable', function(dataResponse, status) {
            $scope.rows = dataResponse;
            if (dataResponse === null || dataResponse === 'null') {
                $scope.errors = true;
                // $scope.parentobj.ControllerFunnnel = status;
                removeSankey();
            } else {
                // $scope.parentobj.ControllerFunnnel = 'null';
                $scope.errors = false;
                $scope.pi = dataResponse[0];
                $scope.createFunnel($scope.pi);
            }
            msgtemp['status'] = 'ControllerFunnnel';
            msgtemp['call'] = null;
            sharedDataService.prepForBroadcast(msgtemp);

        });
    };

    var role = getCookie('role');
    if (['Super', 'Admin', 'Juspay', 'Bank', 'Pg', 'Client'].indexOf(role) > -1)
        $scope.hide = false;
    // if (['Client'].indexOf(role) > -1)
    //     $scope.errors = true;

    $scope.loadData($scope.client, $scope.from, $scope.to, $scope.filter);

    $scope.$on('handleBroadcast', function(event, messages) {
        var call = null;
        if (messages.hasOwnProperty('call')) {
            call = messages.call;
        }
        if (call && (call === 'all' || call === 'funnel')) {
            if (messages.hasOwnProperty('client')) {
                $scope.client = messages.client;
            }
            if (messages.hasOwnProperty('date')) {
                $scope.from = messages.date.from;
                $scope.to = messages.date.to;
            }
            if (messages.hasOwnProperty('filter')) {
                $scope.filter = messages.filter;
            }
            $scope.loadData($scope.client, $scope.from, $scope.to, $scope.filter)
        }
    });
}

