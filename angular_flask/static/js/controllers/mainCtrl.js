'use strict';
/* Controllers */

function IndexController($scope) {

}

function AboutController($scope) {

}


function NavController($scope, $http, role) {
    role.getRole(function(data) {
        if (data == 'Super' || data == 'Admin') {
            $scope.hide = false
        } else {
            $scope.hide = true
        }

    });

    $scope.logout = function() {
        var params = {
            "uuid": getCookie("uuid")
        }
        $http({
            url: '/logout',
            method: "POST",
            data: params,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getCookies()["access_token"]
            }
        }).
        success(function(data) {
            delCookie('uuid');
            delCookie('session_uuid');
            delCookie('authtype');
            delCookie('access_token');

        }).
        error(function(data) {
            delCookie('uuid');
            delCookie('session_uuid');
            delCookie('access_token');
            delCookie('authtype');
        });
    }
    getState()

    // curl -H "Accept: application/json" -H "Content-Type: application/json" -H "Authorization: 26t96yCjB08a8fybbF5ub7t69POHQOPR" -d '{ "conditions": { "remoteVersion": ["0.4rc4"]},  "interval": [1426404475, 1426504475]}' https://godel-test.appspot.com/search
    // $scope.logout = function(){
    //     var params = { "conditions": { "remoteVersion": ["0.4rc4"]},  "interval": [1426404475, 1426504475]}
    //     var result = $http({
    //         url:'/search',
    //         method: "POST",
    //         data: params,
    //         headers: {'Content-Type': 'application/json','Authorization': "26t96yCjB08a8fybbF5ub7t69POHQOPR"}
    //     }).
    //     success(function(data) {

    //     }).
    //     error(function(data,status) {
    //     });
    // }
}

function LoginController($scope, $location, sharedDataService, role, $http) {
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

function LoginOptionController($scope, $location, $http) {


    $scope.hideit = function() {
        $scope.errorhide = true;

    };

    $scope.hideit();
    $scope.goTo = function(path) {
        window.location = "/login"
    };

    $scope.postchk = function() {
        if ($scope.user && $scope.pass) {

            var params = {
                'username': $scope.user.toLowerCase().trim(),
                'password': $scope.pass,
                'api': 'login'
            }
            var result = $http({
                url: '/authsso',
                method: "POST",
                data: params,
                headers: {
                    'Content-Type': 'application/json',
                }
            }).
            success(function(data) {
                if (data.success) {
                    var payload = {
                        'token': data.token,
                        'email': data.username,
                        'type': 'customauth',
                        'success': data.success
                    }

                    $scope.authit(payload);

                } else {
                    $scope.errorMessage = "Invalid Username or Password!";
                    $scope.errorhide = false;

                }

            });
        } else {
            $scope.errorMessage = "Both fields are mandatory";
            $scope.errorhide = false;

        }

    }


    $scope.authit = function(payload) {


        var result = $http({
            url: '/customauth',
            method: 'POST',
            data: payload,
            headers: {
                'Content-Type': 'application/json',
            }
        }).success(function() {
            window.location = "/"
        })

    }

}

function RegisterController($scope, $http, sharedDataService) {

    $scope.hideErr = function() {
        $scope.regErrorHide = true;
        $scope.regMsgHide = true;

    };
    $scope.hideErr();
    $scope.registerUser = function() {


        if ($scope.uname && $scope.password && $scope.fname && $scope.appname) {

            var params = {
                'fullname': $scope.fname,
                'username': $scope.uname.toLowerCase().trim(),
                'password': $scope.password,
                'api': 'signup',
                'token': getCookie('access_token')
            }
            var result = $http({
                url: '/authsso',
                method: "POST",
                data: params,
                headers: {
                    'Content-Type': 'application/json'

                }
            }).
            success(function(data) {
                if (data.success) {
                    var params = {
                        'email': $scope.uname.toLowerCase().trim(),
                        'role': $scope.role,
                        'appname': $scope.appname,
                    }

                    var result = $http({
                        url: '/users/adduser',
                        method: "POST",
                        data: params,
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': getCookies()["access_token"]
                        }
                    }).success(function(data) {
                        $scope.regMsg = "User: " + $scope.uname + " Added Successfully";
                        $scope.regMsgHide = false;
                    }).
                    error(function(data, status) {
                        $scope.regError = "User Registered but not added.";
                        $scope.regErrorHide = false;
                    });


                } else {
                    $scope.regError = "Username Already Exist!";
                    $scope.regErrorHide = false;

                }

            });
        } else {
            $scope.regError = "All fields are mandatory";
            $scope.regErrorHide = false;

        }
    }

}


function UpdateUserController($scope, $http, sharedDataService) {

    $scope.hideErr = function() {
        $scope.regErrorHide = true;
        $scope.regMsgHide = true;

    };
    $scope.hideErr();
    $scope.uname = getCookie('email').replace(/\"/g, "");
    $scope.updateUser = function() {




        if (angular.equals($scope.newpassword, $scope.confirmpassword)) {

            if ($scope.uname && $scope.oldpassword && $scope.newpassword) {

                var params = {
                    'username': $scope.uname.toLowerCase().trim(),
                    'password': $scope.oldpassword,
                    'newpassword': $scope.newpassword,
                    'api': 'update'
                }
                var result = $http({
                    url: '/authsso',
                    method: "POST",
                    data: params,
                    headers: {
                        'Content-Type': 'application/json',
                        // 'x-auth-token': getCookie('access_token')
                    }
                }).
                success(function(data) {
                    if (data.success) {


                        $scope.regMsg = "User: " + $scope.uname + " Updated Successfully";
                        $scope.regMsgHide = false;
                        setTimeout(function() {
                            // window.location = "/login_opt";
                            window.location = "/login"

                        }, 1000);

                    } else {
                        $scope.regError = "Wrong Credentials!";
                        $scope.regErrorHide = false;

                    }

                });
            } else {
                $scope.regError = "All fields are mandatory";
                $scope.regErrorHide = false;

            }

        } else {
            $scope.regError = "Password Mismatch!";
            $scope.regErrorHide = false;
        }
    }

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

//ALERTS CONTROLLER
//ALERTS CONTROLLER
function AlertsController($scope, $http, sharedDataService) {

    $scope.parent = {}
    $scope.parent.query = ""
    $scope.parent.column = {}
    $scope.parent.data = []
    $scope.itemsPerPage = 10;
    $scope.parent.pagedItems = [];
    $scope.parent.currentPage = 1;
    $scope.totalItems = 0;
    $scope.maxSize = 8;
    $scope.parent.jobs_list = []
    $scope.parent.check = {}
    $scope.parent.view_query = ""
    $scope.parent.column_name = ""
    $scope.parent.sel_column_name = ""
    $scope.parent.row = {}
    $scope.alerts = [];
    $scope.parent.at = "1 hr"
    $scope.parent.hide = true
    $scope.parent.type = 'Alert'
    $scope.parent.recipient = 'team@juspay.in'
    $scope.buttonText = 'SCHEDULE ALERT'

    $scope.addAlert = function(type, mssg) {
        $scope.alerts.push({
            type: type,
            msg: mssg
        });
    };

    $scope.closeAlert = function(index) {
        $scope.alerts.splice(index, 1);
    };

    $scope.login = function(status) {
        if (status == "403") {
            window.location = "/login";
        }
    };

    $scope.getRecipient = function() {
        if ($scope.parent.row.recipient == 'Other') {
            return $scope.parent.row.other
        } else {
            return $scope.parent.row.recipient
        }
    };

    $scope.scheduleAlert = function() {
        $scope.alerts = [];
        var recipient = $scope.getRecipient();
        sharedDataService.openLoadingModal('sm');
        var params = {
            "key": $scope.parent.row.key,
            "query": $scope.parent.row.query,
            "parent_key": $scope.parent.row.at,
            "column": $scope.parent.row.column_name,
            "threshold": $scope.parent.row.threshold,
            "job_type": $scope.parent.row.job_type,
            "recipient": recipient,
            "action": $scope.buttonText.split(' ')[0].toLowerCase()
        };
        if ($scope.parent.type == 'Report') {
            params.column = "-"
            params.threshold = "-"
        }

        var result = $http({
            url: '/cron/addjob',
            method: "POST",
            data: params,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getCookies()["access_token"]
            }
        }).
        success(function(data) {
            if (data.value == 'Error') {
                $scope.addAlert("danger", data.msg);
                sharedDataService.closeLoadingModal();
            } else {
                if ($scope.buttonText.split(' ')[0].toLowerCase() === 'edit') {
                    $scope.addAlert("success", "Alert Edited successfuly");
                } else {
                    $scope.addAlert("success", "Alert Scheduled");
                }
                $scope.buttonText = "SCHEDULE ALERT";
                sharedDataService.closeLoadingModal();
            }
        }).
        error(function(data, status) {
            $scope.login(status);
            $scope.addAlert("danger", "Error, with status code: " + status);
            sharedDataService.closeLoadingModal();
        });
    }

    $scope.listAlerts = function() {
        $scope.parent.view_query = ""
        $scope.parent.check = {}
        $scope.parent.sel_column_name = ""
        $scope.parent.row = {}

        var result = $http({
            url: '/cron/getalertlist',
            method: "POST",
            data: {},
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getCookies()["access_token"]
            }
        }).
        success(function(data) {
            $scope.parent.jobs_list = data;
        }).
        error(function(data, status) {
            $scope.login(status);
        });
    }

    $scope.showQuery = function(val) {
        $scope.parent.row = val
        $scope.parent.view_query = val.query
        $scope.parent.sel_column_name = val.column_name
    }

    $scope.editAlert = function() {
        $scope.buttonText = 'EDIT ALERT';
    }

    $scope.rmAlert = function() {
        if ($scope.parent.row == {})
            return
        else {
            var data = {
                'parent_key': $scope.parent.row.at,
                'key': $scope.parent.row.key
            }

            var result = $http({
                url: '/cron/removealert',
                method: "POST",
                data: data,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': getCookies()["access_token"]
                }
            }).
            success(function(data) {
                $scope.listAlerts()
            }).
            error(function(data, status) {
                $scope.login(status);
            });

        }
    }

    $scope.groupToPages = function() {
        $scope.parent.currentPage = 1;
        $scope.parent.pagedItems = [];
        var pages;
        for (var i = 0; i < +$scope.parent.data.length; i++) {
            pages = Math.floor(i / $scope.itemsPerPage);
            if (i % $scope.itemsPerPage === 0) {
                $scope.parent.pagedItems[Math.floor(i / $scope.itemsPerPage)] = [$scope.parent.data[i]];
            } else {
                $scope.parent.pagedItems[Math.floor(i / $scope.itemsPerPage)].push($scope.parent.data[i]);
            }
        }
        $scope.totalItems = (pages + 1) * 10;
        sharedDataService.closeLoadingModal();
    };

    $scope.changeDataType = function(data) {
        $scope.parent.column = {}
        for (var itr in data.schema.fields) {
            $scope.parent.column[itr] = data.schema.fields[itr]['name'];
            if (data.schema.fields[itr]['type'] != "STRING") {
                for (var i in data.rows) {
                    data.rows[i]['f'][itr]['v'] = +data.rows[i]['f'][itr]['v'];
                }

            }
        }
        $scope.parent.data = [];
        for (var itr in data.rows) {
            var obj = {}
            for (var i in data.rows[itr]['f']) {
                obj[i] = data.rows[itr]['f'][i]['v']
            }
            $scope.parent.data[itr] = obj;
        }
        return $scope.parent.data;
    }

    $scope.clear = function() {
        $scope.parent.hide = true
        $scope.parent.column = []
        $scope.parent.pagedItems = []
        $scope.parent.type = 'Alert'
        $scope.parent.recipient = 'team@juspay.in'
        $scope.apply

    }

    $scope.test = function() {
            $scope.parent.column = []
            $scope.parent.pagedItems = []
            $scope.alerts = []
            sharedDataService.openLoadingModal('sm');
            var params = {
                "query": $scope.parent.row.query
            };
            var result = $http({
                url: '/bq/testquery',
                method: "POST",
                data: params,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': getCookies()["access_token"]
                }
            }).
            success(function(data) {
                $scope.parent.data = data;
                if (data == 'null') {
                    $scope.addAlert("info", "Data Response is Null");
                    sharedDataService.closeLoadingModal();
                } else {
                    $scope.parent.data = $scope.changeDataType($scope.parent.data);
                    $scope.groupToPages();
                    $scope.parent.hide = false
                }
            }).
            error(function(data, status) {
                $scope.login(status);
                $scope.addAlert("danger", "Error; Check the Query");
                sharedDataService.closeLoadingModal();
                return null;
            });
        } //END TEST()

}
// END ALERTS_CONTROLLER
// END ALERTS_CONTROLLER

function QueryController($scope, $http, $filter, sharedDataService, $location, $anchorScroll) {

    $scope.parent = {}
    $scope.itemsPerPage = 10;
    $scope.parent.pagedItems = [];
    $scope.parent.column = {};
    $scope.parent.data = [];
    $scope.parent.currentPage = 1;
    $scope.totalItems = 0;
    $scope.maxSize = 8;
    $scope.parent.reverse = false;
    $scope.alerts = [];

    if ($scope.parent.data.length <= 0) {
        $scope.parent.hide = true;
    }

    var orderBy = $filter('orderBy');

    $scope.login = function(status) {
        if (status == "403") {
            window.location = "/login";
        }
    };

    $scope.addAlert = function(type, mssg) {
        $scope.alerts.push({
            type: type,
            msg: mssg
        });
    };

    $scope.closeAlert = function(index) {
        $scope.alerts.splice(index, 1);
    };

    $scope.order = function(predicate, reverse) {
        var page = $scope.parent.currentPage;
        if ($scope.parent.data.length > 0) {
            $scope.parent.data = orderBy($scope.parent.data, predicate, reverse);
            $scope.groupToPages();
            $scope.parent.currentPage = page;
        }
    };

    // $scope.order('-0',false);

    $scope.changeDataType = function(data) {
        $scope.parent.column = {}
        for (var itr in data.schema.fields) {
            $scope.parent.column[itr] = data.schema.fields[itr]['name'];
            if (data.schema.fields[itr]['type'] != "STRING") {
                for (var i in data.rows) {
                    data.rows[i]['f'][itr]['v'] = +data.rows[i]['f'][itr]['v'];
                }

            }
        }
        $scope.parent.data = [];
        for (var itr in data.rows) {
            var obj = {}
            for (var i in data.rows[itr]['f']) {
                obj[i] = data.rows[itr]['f'][i]['v']
            }
            $scope.parent.data[itr] = obj;
        }
        return $scope.parent.data;
    }

    $scope.groupToPages = function() {
        $scope.parent.hide = false;
        $scope.parent.currentPage = 1;
        $scope.parent.pagedItems = [];
        var pages;
        for (var i = 0; i < +$scope.parent.data.length; i++) {
            pages = Math.floor(i / $scope.itemsPerPage);
            if (i % $scope.itemsPerPage === 0) {
                $scope.parent.pagedItems[Math.floor(i / $scope.itemsPerPage)] = [$scope.parent.data[i]];
            } else {
                $scope.parent.pagedItems[Math.floor(i / $scope.itemsPerPage)].push($scope.parent.data[i]);
            }
        }
        $scope.totalItems = (pages + 1) * 10;
        sharedDataService.closeLoadingModal();
        $location.hash('bottom');
        $anchorScroll();
    };

    $scope.del_query = function() {
        $scope.alerts = [];
        if ($scope.parent.check.length == undefined) {
            $scope.addAlert("danger", "NO QUERY SELECTED");
            return null
        }
        var d = JSON.parse($scope.parent.check);
        var params = {
            'key': d.query_id
        };
        var result = $http({
            url: '/customquery/delquery',
            method: "POST",
            data: params,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getCookies()["access_token"]
            }
        }).
        success(function(data) {
            for (var itr in $scope.parent.row) {
                if ($scope.parent.row[itr].query_id == d.query_id) {
                    $scope.parent.row.splice(itr, 1);
                    break;
                }
            }
        }).
        error(function(data, status) {
            $scope.login(status);
            return null;
        });
        $scope.reset();
    }

    $scope.select_query = function(val) {
        $scope.alerts = [];
        $scope.parent.column = {};
        $scope.parent.pagedItems = [];
        sharedDataService.openLoadingModal('sm');
        var d = JSON.parse($scope.parent.check);
        $scope.execQuery(d.bq_query);
    }

    $scope.reset = function() {
        $scope.parent.check = {};
        $scope.parent.column = {};
        $scope.parent.pagedItems = [];
        $scope.parent.hide = true;
    }

    $scope.openTab = function(tab) {
        $scope.alerts = [];
        $scope.reset();
        if (tab == 2) {
            var params = {};
            var result = $http({
                url: '/customquery/updatequery',
                method: "POST",
                data: params,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': getCookies()["access_token"]
                }
            }).
            success(function(data) {
                for (var itr in data) {
                    data[itr]['query_id'] = data[itr]['query_id'].split("|")[1];
                }
                $scope.parent.row = data;
            }).
            error(function(data, status) {
                $scope.login(status);
                return null;
            });
        }
    }

    $scope.test = function() {
        $scope.alerts = [];
        if ($scope.parent.textareaValue == undefined) {
            $scope.addAlert("danger", "NO INPUT");
        } else {
            sharedDataService.openLoadingModal('sm');
            var query = $scope.parent.textareaValue.trim();
            $scope.execQuery(query);
            $location.hash('bottom');
            $anchorScroll();
        }
    }

    $scope.execQuery = function(query) {
        var params = {
            "query": query
        };
        var result = $http({
            url: '/bq/execquery',
            method: "POST",
            data: params,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getCookies()["access_token"]
            }
        }).
        success(function(data) {
            $scope.parent.data = data;
            if (data == 'null') {
                sharedDataService.closeLoadingModal();
                $scope.addAlert("danger", "DATA RESPONSE IS NULL");
                $scope.reset();
            } else {
                $scope.parent.data = $scope.changeDataType($scope.parent.data);
                $scope.groupToPages();
            }
        }).
        error(function(data, status) {
            $scope.login(status);
            $scope.reset();
            sharedDataService.closeLoadingModal();
            $scope.addAlert("danger", " HTTP ERROR : " + status);
            return null;
        });
    }

    $scope.customQuery = function() {
        $scope.alerts = [];
        var params = {
            "query": $scope.parent.textareaValue.trim(),
            "key": $scope.parent.key
        };
        for (var itr in $scope.parent.row) {
            if ($scope.parent.row[itr]['query_id'] == $scope.parent.key) {
                $scope.addAlert("danger", " DUPLICATE KEY");
                return;
            }
        }
        sharedDataService.openLoadingModal('sm');

        var result = $http({
            url: '/bq/customquery',
            method: "POST",
            data: params,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getCookies()["access_token"]
            }
        }).
        success(function(data) {
            $scope.parent.data = data;
            if (data == 'null') {
                sharedDataService.closeLoadingModal();
                $scope.addAlert("danger", " CAN'T ADD, DATA RESPONSE IS NULL");
                $scope.reset();
            } else {
                $scope.parent.data = $scope.changeDataType($scope.parent.data);
                $scope.groupToPages();
                if ($scope.parent.row) {
                    $scope.parent.row.push({
                        'query_id': $scope.parent.key,
                        'bq_query': $scope.parent.textareaValue.trim()
                    });
                } else {
                    $scope.parent.row = [{
                        'query_id': $scope.parent.key,
                        'bq_query': $scope.parent.textareaValue.trim()
                    }]
                }
                $scope.addAlert("success", "ADDED");
            }
        }).
        error(function(data, status) {
            $scope.login(status);
            $scope.reset();
            sharedDataService.closeLoadingModal();
            $scope.addAlert("danger", " HTTP ERROR:" + status);
            return null;
        });
    }

    $scope.openTab(2);
}

function ToggleController($scope, $http, sharedDataService) {

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


function FilterController($scope, $http, sharedDataService) {
    $scope.filter = defaultFilter;
    $scope.client = merchant;
    $scope.from = from;
    $scope.to = to;
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
            'sim_operator': '',
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
            "where_clause": where
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
                    'network','sim_operator', 'godel_version', 'app_version', 'godel_remotes_version', 'is_godel', 'auth_method',
                    'weblab', 'app_name', 'os', 'experiments', 'log_level'
                ]
            } else if (['Client'].indexOf(role) > -1) {
                $scope.rowOrder = ['merchant_payment_status', 'payment_gateway', 'aggregator', 'wallet', 'payment_status',
                    'payment_instrument', 'payment_instrument_group', 'network', 'sim_operator', 'os', 'godel_version', 'app_version',
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
        if($scope.user && $scope.user.where_text) {
            $scope.user.where_text = "";
        }
        else {
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

function CountsController($scope, $http, sharedDataService) {







    $scope.filter = defaultFilter
    $scope.client = merchant
    $scope.from = from
    $scope.to = to
    $scope.errors = false;
    $scope.show = false;

    var state = getState();
    if (state['show_lines'] && typeof state['show_lines'] === 'object' && state['show_lines'].length === 7) {
        updateState(state);

    } else {
        state['show_lines'] = [false, false, true, true,false, false, false];
        updateState(state);

    }
    $scope.isChecked = state['show_lines'];

    $scope.loadData = function(id, from, to, filter, notCount) {
        $scope.show = false;
        if (notCount) {
            var notCount = notCount;
        } else {
            var notCount = 'F';
        }
        var data = {
            "clientID": id,
            "from": from,
            "to": to,
            "filters": filter,
            "where_clause": where,
        };
        var msgtemp = {};
        sharedDataService.loadData('/bq/counts', data, 'countLoader', 'countTable', function(dataResponse, status) {
            $scope.rows = dataResponse;
            var formatted_resp = []
            var rowset = makerows($scope.rows);
            var csvrows = makecsv($scope.rows);
            $scope.rows = {
                counts: formatted_resp
            }

            if (dataResponse === null || dataResponse === 'null') {
                $scope.errors = true;
                $scope.parentobj.ControllerCount = status;
            } else {
                $scope.parentobj.ControllerCount = "null";
                $scope.errors = false;
                $scope.show = true;
                // $scope.chartObjects= donutpie();
                // $scope.chartObj = countChart();
                // nvd3Donut(parseInt($scope.total_success), parseInt($scope.total_failure));
                $scope.updatePanel($scope.rows.counts, rowset, csvrows, notCount);
            }
            msgtemp['call'] = null;
            msgtemp['status'] = 'ControllerCount';
            sharedDataService.prepForBroadcast(msgtemp);
        });
    };
    $scope.updatePanel = function(row, rowset, csvrows, notCount) {
        $scope.total_success = rowset[1];
        $scope.total_failure = rowset[2];
        $scope.total_sessions = $scope.total_success + $scope.total_failure;
        $scope.avg_success = parseInt($scope.total_success / $scope.total_sessions * 100);
        $scope.chartObjects = donutpie($scope.total_success, $scope.total_failure);
        nvd3Donut(parseInt($scope.total_success), parseInt($scope.total_failure));
        // pieChart(donutchart,sampleData);
        if (notCount === 'F') {
            $scope.countChart = countChart(rowset[0]);
            doDygraph(csvrows,'dydygraphs');
            nvd3Donut(parseInt($scope.total_success), parseInt($scope.total_failure));

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

    $scope.changeTimeframe = function(event) {
        var range = chart.getVisibleChartRange();
        var s = range.start;
        var e = range.end;



    }


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
        if ($scope.newStartE && $scope.newEndE) {

            var newSE = parseInt($scope.newStartE / 1000);
            var newEE = parseInt($scope.newEndE / 1000);
            // if(getCookie('timeFormat') === 'IST'){
            //     newSE = newSE - 19800;
            //     newEE = newEE - 19800;
            // }
            var newS = new Date(newSE * 1000);
            var newE = new Date(newEE * 1000);

            // var dateStr = date.getFullYear() + "/" + (date.getMonth() + 1) + "/" + date.getDate() + "_" + date.getHours() + ":" +
            // date.getMinutes() + ":" + date.getSeconds() ;

            var newSStr = newS.getFullYear() + "/" +
                ('0' + (newS.getMonth() + 1)).slice(-2) + "/" +
                ('0' + newS.getDate()).slice(-2) + "_" +
                ('0' + newS.getHours()).slice(-2) + ":" +
                ('0' + newS.getMinutes()).slice(-2) + ":" +
                ('0' + newS.getSeconds()).slice(-2);

            var newEStr = newE.getFullYear() + "/" +
                ('0' + (newE.getMonth() + 1)).slice(-2) + "/" +
                ('0' + newE.getDate()).slice(-2) + "_" +
                ('0' + newE.getHours()).slice(-2) + ":" +
                ('0' + newE.getMinutes()).slice(-2) + ":" +
                ('0' + newE.getSeconds()).slice(-2);

            $scope.filterByTime(newSStr, newEStr);

        }
    }



    var fristLoad = false;

    $scope.styleSvg_click = function() {

        if (firstLoad === true) {

            setTimeout(function() {
                angular.element(chart_div_AnnotationChart_zoomControlContainer_max).click();
            }, 0);
            firstLoad = false;

        }
        setTimeout(function() {
            document.querySelector("#chart_div_AnnotationChart_chartContainer > div > div > div > svg").style.padding = '0px 0px 0px 10px';

        }, 300);

    }

    $scope.styleSvg = function() {
        firstLoad = true;

    }




    $scope.resetByTime = function(fromTime, toTime) {
        var state = getState()
        state['from'] = $scope.fromTime;
        state['to'] = $scope.toTime;
        updateState(state)
        var msgtemp = {};
        var resetFrom = $scope.fromTime.substring(0, 11) + "00:00:00";
        var resetTo = $scope.toTime.substring(0, 11) + "23:59:59";
        msgtemp['date'] = {
            "from": resetFrom,
            "to": resetTo
        };
        msgtemp['call'] = 'all';
        sharedDataService.prepForBroadcast(msgtemp);

    }

    $scope.loadData($scope.client, $scope.from, $scope.to, $scope.filter)

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
}

function SegmentsController($scope, $http, sharedDataService, sortService, $q) {
    $scope.parent = {}
    $scope.filter = defaultFilter
    $scope.client = merchant
    $scope.from = from
    $scope.to = to
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

    var tabsList = ['payment_instrument', 'merchant_id', 'payment_instrument_group', 'godel_version', 'payment_gateway', 'aggregator', 'network','sim_operator', 'app_version', 'payment_processor', 'weblab'];

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
                'stored_card', 'udf_type', 'network','sim_operator', 'godel_version', 'numpages', 'auth_method',
                'authentication_status', 'amount', 'os', 'payment_status', 'os_version', 'card_brand',
                'screen_ppi', 'app_version', 'payment_processor', 'brand', 'payment_instrument_group',
                'payment_instrument', 'dropout_reasons', 'godel_remotes_version', 'latency',
                'numscreens', 'model', 'network_type', 'godel_build_version', 'screen_height',
                'last_visited_url', 'card_token', 'payment_gateway', 'aggregator', 'experiments', 'run_date','run_week', 'run_month',
            ]
        } else if (['Client'].indexOf(role) > -1) {
            var fieldList = ['customer_email', 'screen_width', 'customer_phone_number', 'customer_id', 'bank',
                'stored_card', 'udf_type', 'network','sim_operator', 'numpages', 'auth_method',
                'amount', 'os', 'payment_status', 'os_version', 'card_brand', 'screen_ppi',
                'app_version', 'payment_processor', 'brand', 'payment_instrument_group',
                'payment_instrument', 'dropout_reasons', 'latency', 'numscreens', 'model',
                'network_type', 'screen_height', 'last_visited_url', 'card_token', 'payment_gateway',
                'aggregator', 'weblab', 'merchant_id', 'otp_auto_submitted', 'run_date','run_week', 'run_month',
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
            "where_clause": where
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
                $scope.parentobj.ControllerSegments = status;
                $scope.errors = true;
            } else {
                $scope.parentobj.ControllerSegments = 'null';
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
                            $scope.rows[header][data].dropout_res = $scope.rows[header][data].dropout_res.split(",");
                            for (var itr in $scope.rows[header][data].dropout_res) {
                                var i = +$scope.rows[header][data].dropout_res[itr].split("(")[1].split(")")[0];
                                i = Math.round(i / ($scope.rows[header][data].t_count - $scope.rows[header][data].pay_s) * 100);
                                $scope.rows[header][data].dropout_res[itr] = $scope.rows[header][data].dropout_res[itr].split("(")[0] + " (" + String(i) + "%)";
                            }
                            $scope.rows[header][data].dropout_res = $scope.rows[header][data].dropout_res.slice(0, 10);
                            $scope.rows[header][data].dropout_res = $scope.rows[header][data].dropout_res.toString().replace(/,/g, "<br>");
                            
                            $scope.rows[header][data].max = $scope.rows[header][data].dropout_res.split("<br>")[0];
                            if ($scope.rows[header][data].max.split("(")[0].trim()  == 'NULL' && temp.split(",").length > 1) {
                                $scope.rows[header][data].max = $scope.rows[header][data].dropout_res.split("<br>")[1].split("<br>")[0];
                            }
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
        });

    };

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
            "Success", "Faliure", "Unknowns", "Last_7_Days", "Last_14_Days", "Success_Rate", "Merchant_Payment_Status", "Top_Dropout", "All_Dropouts"
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
            "tab": $scope.tab_name,
            "where_clause": where,

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

function FunnelController($scope, $http, sharedDataService) {
    $scope.filter = defaultFilter
    $scope.client = merchant
    $scope.from = from
    $scope.to = to
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
        };
        var msgtemp = {};
        sharedDataService.loadData('/bq/funnel_data', data, 'funnelLoader', 'funnelTable', function(dataResponse, status) {
            removeSankey();
            $scope.sankeyHide = false;
            if (dataResponse === null || dataResponse === 'null') {
                $scope.errors = true;
                $scope.sankeyHide = false;
                $scope.parentobj.ControllerFunnnel = status;
            } else {
                if (dataResponse.length == 4) {
                    $scope.errors = true;
                } else {
                    $scope.errors = false;
                    $scope.funnelResult = dataResponse;
                    makeSankey($scope.funnelResult);
                }
                $scope.sankeyHide = false;
                $scope.parentobj.ControllerFunnnel = 'null';
            }
            msgtemp['status'] = 'ControllerFunnnel';
            msgtemp['call'] = null;
            sharedDataService.prepForBroadcast(msgtemp);

        });
    };

    $scope.loadData = function(id, from, to, filter) {
        var data = {
            "clientID": id,
            "from": from,
            "to": to,
            "filters": filter,
            "where_clause": where
        };
        var msgtemp = {};
        sharedDataService.loadData('/bq/funnels', data, 'funnelLoader', 'funnelTable', function(dataResponse, status) {
            $scope.rows = dataResponse;
            if (dataResponse === null || dataResponse === 'null') {
                $scope.errors = true;
                $scope.parentobj.ControllerFunnnel = status;
                removeSankey();
            } else {
                $scope.parentobj.ControllerFunnnel = 'null';
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

function ClientsController($scope, $http, sharedDataService) {
    $scope.client = merchant
    $scope.from = from
    $scope.to = to
    $scope.prop = null;

    if ($scope.client){
        $scope.defaultClient = $scope.client
    }
    else{
        $scope.defaultClient = 'Juspay Demo'
    }

    $scope.getAllClients = function (callback) {
        var msgtemp = {};
        var params = {
                "from": $scope.from,
                "to": $scope.to,
            };

        $http({
                url: '/bq/clients',
                method: "POST",
                data: params,
                headers: {'Content-Type': 'application/json', 'Authorization': getCookies()["access_token"]}
            }).
            success(function(data ,status) {
                $scope.rows = data;
                if ($scope.rows.client_id.length === 1) {
                    $scope.hide = true
                    $scope.prop = $scope.rows.client_id[0];
                } else {
                    var arr = []
                    for (var itr in $scope.rows['client_id']) {
                        arr[itr] = $scope.rows['client_id'][itr]['an'].substring(0,25)
                    }
                    $scope.rows['client_id'] = arr;
                    $scope.hide = false;
                    $scope.prop = getState().client || $scope.client;

                }
                if (['Super', 'Admin', 'Juspay'].indexOf($scope.parentobj['role']) > -1) {
                    $scope.rows['client_id'].unshift("All")
                }
                // $scope.rows['client_id'].sort($scope.sortCase)
                $scope.client_list = $scope.rows['client_id']
                $scope.parentobj.ControllerClients = status;
                msgtemp['status'] = 'ControllerClients';
                msgtemp['call'] = null;
                sharedDataService.prepForBroadcast(msgtemp);
                callback($scope.client_list);
            })
};



    $scope.loadData = function(from, to) {
        var data = {
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
                con

            }
            if (['Super', 'Admin', 'Juspay'].indexOf($scope.parentobj['role']) > -1) {
                $scope.rows['client_id'].unshift("All")
            }
            // $scope.rows['client_id'].sort($scope.sortCase)
            $scope.client_list = $scope.rows['client_id']
            $scope.parentobj.ControllerClients = status;
            msgtemp['status'] = 'ControllerClients';
            msgtemp['call'] = null;
            sharedDataService.prepForBroadcast(msgtemp);
            // sendClient($scope.client_list);
            // callback($scope.client_list);

        });
    };

    
    $scope.switchClient = function(client) {
        var state = getState()
        state['client'] = client;
        state['dimension'] = "";
        updateState(state)
        var msgtemp = {};
        msgtemp['client'] = client;
        msgtemp['filterFlush'] = true; // clearing the filter on client change
        msgtemp['reset'] = true;
        msgtemp['call'] = 'toggle';

        sharedDataService.prepForBroadcast(msgtemp);
    };

    
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
            $scope.getAllClients(function(x){return x;})
        }
    });
};


function DateChangeController($scope, sharedDataService) {
    $scope.$on('$routeChangeSuccess', function() {
        datePicker();
    });
    $scope.dateChange = function(startDate, endDate) {
        var state = getState()
        state['from'] = startDate;
        state['to'] = endDate;
        updateState(state);
        var msgtemp = {};
        msgtemp['date'] = {
            "from": startDate + "_" + "00:00:00",
            "to": endDate + "_" + "23:59:59"
        };
        msgtemp['call'] = 'all';
        sharedDataService.prepForBroadcast(msgtemp);
    };
}

function SessionController($scope, $http, $filter, $modal, $log, sharedDataService) {
    $scope.rows = null;
    $scope.errors = false;
    $scope.loadData = function(id, from, to, filter) {
        var data = {
            "clientID": id,
            "from": from,
            "to": to,
            "filters": filter,
            "where_clause": where
        };
        var msgtemp = {};
        sharedDataService.loadData('/bq/sessions', data, '', '', function(dataResponse, status) {
            $scope.rows = dataResponse;
            sharedDataService.closeLoadingModal();
            if (dataResponse === null || dataResponse === 'null') {
                $scope.errors = true;
                $scope.parentobj.ControllerSession = status;
            } else {
                $scope.parentobj.ControllerSession = 'null';
                $scope.errors = false;
                $scope.openSessionModal('lg', $scope.rows, $scope.header);
            }
            msgtemp['status'] = 'ControllerSession';
            msgtemp['call'] = null;
            sharedDataService.prepForBroadcast(msgtemp);
        });
    };
    $scope.filter = defaultFilter
    $scope.client = merchant;
    $scope.from = from;
    $scope.to = to;
    $scope.ft = null;
    $scope.header = null;

    $scope.$on('handleBroadcast', function(event, messages) {

        var stype = null;
        var value = null;
        var sval = null;
        var call = null;
        if (messages.hasOwnProperty('call')) {
            call = messages.call;
        }
        if (call && (call === 'session')) {
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
            if (messages.hasOwnProperty('session')) {
                var value = messages.session.value
                var stype = messages.session.stype
                var sval = messages.session.sval
            }
            sharedDataService.openLoadingModal('sm');
            $scope.setHeader(value, stype, sval);
            $scope.getSessions(value, stype, sval)
        }
    });

    $scope.setHeader = function(ft, ty, val) {
        function getSessionFilter(ft) {
            var rtype = {
                'auth_y': {
                    'key': 'authentication_status',
                    'value': 'Y'
                },
                'auth_n': {
                    'key': 'authentication_status',
                    'value': 'N'
                },
                'auth_u': {
                    'key': 'authentication_status',
                    'value': 'U'
                },
                'pay_s': {
                    'key': 'payment_status',
                    'value': 'SUCCESS'
                },
                'pay_f': {
                    'key': 'payment_status',
                    'value': 'FAILURE'
                },
                'pay_u': {
                    'key': 'payment_status',
                    'value': 'UNKNOWN'
                }
            };
            return rtype[String(ft)] || null
        }
        var sub_header = getSessionFilter(ft);
        var title = ty.replace(/_/g, " ").toTitleCase();
        if (sub_header !== null) {
            var sub_title = sub_header.key.replace(/_/g, " ").toTitleCase();
            $scope.header = title + ": " + val + ' | ' + sub_title + ': ' + sub_header.value;
        } else {
            $scope.header = title + ": " + val;
        }
    }

    $scope.getSessions = function(ft, ty, val) {
        function getSessionFilter(ft) {
            var rtype = {
                'all': ft,
                'auth_y': {
                    'key': 'authentication_status',
                    'value': 'Y'
                },
                'auth_n': {
                    'key': 'authentication_status',
                    'value': 'N'
                },
                'auth_u': {
                    'key': 'authentication_status',
                    'value': 'U'
                },
                'pay_s': {
                    'key': 'payment_status',
                    'value': 'SUCCESS'
                },
                'pay_f': {
                    'key': 'payment_status',
                    'value': 'FAILURE'
                },
                'pay_u': {
                    'key': 'payment_status',
                    'value': ''
                }
            };
            return rtype[String(ft)] || null
        }
        var tempFilters = getSessionFilter(ft);
        if (ty !== null) {
            if (ty.indexOf(',') != -1) {
                ty = "concat(" + ty + ")"
                val = val.replace(',', '');
            }
            var fv = {
                'key': ty,
                'value': val
            };
            var filterData = [];
            angular.copy($scope.filter, filterData);
            filterData.push(fv)
            if (tempFilters === 'all') {
                $scope.loadData($scope.client, $scope.from, $scope.to, filterData);
            } else if (tempFilters !== null) {
                filterData.push(tempFilters)
                $scope.loadData($scope.client, $scope.from, $scope.to, filterData);
            }
        }
    }

    $scope.openSessionModal = function(size, rows, header) {
        var modalInstance = $modal.open({
            templateUrl: 'sessionModalContent.html',
            controller: 'SessionModalInstanceCtrl',
            size: size,
            windowClass: 'segment-modal-window',
            resolve: {
                all_row: function() {
                    return rows;
                },
                header: function() {
                    return header;
                }
            }
        });

    };
}

function SessionModalInstanceCtrl($scope, $modalInstance, $filter, all_row, header) {

    // For Pagination
    // var sortingOrder = 'stime';
    $scope.sortingOrder = 'stime';
    $scope.reverse = true;
    $scope.filteredItems = [];
    $scope.groupedItems = [];
    $scope.itemsPerPage = 8;
    $scope.pagedItems = [];
    $scope.currentPage = 0;
    $scope.tempCurrentPage = 0;
    $scope.header = header;
    $scope.items = [];
    $scope.show = true;
    $scope.r_url = rUrl();
    $scope.columnNames = {
        'auth': "Auth Method",
        'zauth_status' : "Authentication Status",
        'avglat': "Latency",
        'cbrand': "Card Brand",
        'email': "Email",
        'godel': "Godel Status",
        'lurl': "Last URL",
        'net': "Network",
        'nump': "Pages",
        'order_id': "Transaction ID / Order ID",
        'phone': "Phone",
        'pstat': "Payment Status",
        'sid': "Session ID",
        'stime': "Timestamp",
        'dropout_reasons': "Dropout Reason",
        'd_id':"Device ID",
    }

    function getCookie(key) {
        var name = key + "=";
        var cookie = document.cookie.split(';');
        for (var i = 0; i < cookie.length; i++) {
            var c = cookie[i];
            while (c.charAt(0) == ' ')
                c = c.substring(1);
            if (c.indexOf(name) == 0)
                return c.substring(name.length, c.length);
        }
        return "";
    }

    var role = getCookie('role');
    if (['Super', 'Admin', 'Juspay'].indexOf(role) > -1)
        $scope.show = true;
    else
        $scope.show = false;

    if (all_row != null) {
        $scope.items = [];
        var arr = Object.keys(all_row).map(function(k) {
            return all_row[k]
        });
        for (var a = 0; a < arr.length; a++)
            $scope.items.push(arr[a][0]);
        $scope.totalItems = arr.length;
    }

    function rUrl() {
        // btoa(unescape(encodeURIComponent("?")))
        return atob(unescape(encodeURIComponent("aHR0cHM6Ly9sb2dzLmp1c3BheS5pbi9sb2d2aWV3L3JlYWx0aW1lP3Nlc3Npb25faWQ9Cg==")))
    }
    var searchMatch = function(haystack, needle) {
        if (!needle) {
            return true;
        }
        return haystack.toLowerCase().indexOf(needle.toLowerCase()) !== -1;
    };

    $scope.setPage = function(pageNo) {
        $scope.tempCurrentPage = pageNo;
    };

    $scope.maxSize = 5;
    // init the filtered items
    $scope.search = function() {
        $scope.filteredItems = $filter('filter')($scope.items, function(item) {
            for (var attr in item) {
                if (searchMatch(item[attr], $scope.query))
                    return true;
            }
            return false;
        });
        // take care of the sorting order
        if ($scope.sortingOrder !== '') {
            $scope.filteredItems = $filter('orderBy')($scope.filteredItems, $scope.sortingOrder, $scope.reverse);
        }
        $scope.currentPage = 0;
        // now group by pages
        for (var itr in $scope.filteredItems) {
            var arr = [];
            for (var i in $scope.filteredItems[itr]) {
                var obj = {}
                obj['name'] = i;
                if (i == 'txn_id')
                    continue;
                if (i == 'email' || i == 'phone' || i == 'dropout_reasons')
                    obj['visible'] = false;
                else
                    obj['visible'] = true;
                arr.push(obj);
            }
            $scope.columns = arr;
            break;
        }
        $scope.groupToPages();
    };

    // calculate page in place
    $scope.groupToPages = function() {
        $scope.pagedItems = [];

        for (var i = 0; i < $scope.filteredItems.length; i++) {
            if (i % $scope.itemsPerPage === 0) {
                $scope.pagedItems[Math.floor(i / $scope.itemsPerPage)] = [$scope.filteredItems[i]];
            } else {
                $scope.pagedItems[Math.floor(i / $scope.itemsPerPage)].push($scope.filteredItems[i]);
            }
        }
    };

    $scope.range = function(start, end) {
        var ret = [];
        if (!end) {
            end = start;
            start = 0;
        }
        for (var i = start; i < end; i++) {
            ret.push(i);
        }
        return ret;
    };

    $scope.prevPage = function() {
        if ($scope.currentPage > 0) {
            $scope.currentPage--;
        }
    };

    $scope.nextPage = function() {
        if ($scope.currentPage < $scope.pagedItems.length - 1) {
            $scope.currentPage++;
        }
    };

    $scope.setPage = function() {
        // $scope.currentPage = this.n;
        $scope.currentPage = $scope.tempCurrentPage - 1;
    };

    // functions have been describe process the data for display
    $scope.search();

    // change sorting order
    $scope.sort_by = function(newSortingOrder) {
        if ($scope.sortingOrder == newSortingOrder)
            $scope.reverse = !$scope.reverse;
        $scope.sortingOrder = newSortingOrder;

        // icon setup
        $('th i').each(function() {
            // icon reset
            $(this).removeClass().addClass('icon-sort');
        });
        if ($scope.reverse)
            $('th.' + new_sorting_order + ' i').removeClass().addClass('fa fa-sort-asc padded');
        else
            $('th.' + new_sorting_order + ' i').removeClass().addClass('fa fa-sort-desc padded');
    };


    $scope.ok = function() {
        $modalInstance.close();
    };

    $scope.cancel = function() {
        $modalInstance.dismiss('cancel');
    };

    $scope.dataJson = function() {
        var arr = []
        angular.forEach(all_row, function(v) {
            arr.push({
                "session_id": v[0].sid,
                "device_id": v[0].d_id,
                "txn_id": v[0].txn_id,
                "payment_status": v[0].pstat,
                "zauth_status": v[0].auth_status,
                "network": v[0].net,
                "avg_latency": v[0].avglat,
                "num_pages": v[0].nump,
                "auth_method": v[0].auth,
                "timestamp": v[0].stime,
                "godel_status": v[0].godel,
                "last_url": v[0].lurl,
                "email": v[0].email,
                "phone": v[0].phone,
                "dropout_reasons": v[0].dropout_reasons
            })
        });
        return arr
    }

    $scope.headerJson = function() {
        return ["session_id", "txn_id", "payment_status","zauth_status", "network", "avg_latency", "num_pages",
            "auth_method", "timestamp", "godel_status", "last_url", "email", "phone", "dropout_reasons"
        ]
    }

    $scope.fdate = (new Date).getTime();
}

function SegmentMetricController($scope, $http, $filter, $modal, $log, sharedDataService) {

    $scope.rows = null;
    $scope.errors = false;
    $scope.loadData = function(id, from, to, filter) {
        var data = {
            "clientID": id,
            "from": from,
            "to": to,
            "filters": filter,
            "where_clause": where
        };
        sharedDataService.loadData('/bq/segmentMetrics', data, '', '', function(dataResponse, status) {
            $scope.rows = dataResponse;
            sharedDataService.closeLoadingModal();
            if (dataResponse === null || dataResponse === 'null')
                $scope.errors = true;
            else {
                $scope.errors = false;
                $scope.openSegmentMetricModal('lg', $scope.rows, $scope.header, data);
            }
        });
    };

    $scope.filter = defaultFilter
    $scope.client = merchant;
    $scope.from = formatDate(new Date(new Date().setDate(new Date().getDate() - 89))); //Last 90 Days
    $scope.to = to;
    $scope.ft = null;
    $scope.header = null;

    $scope.$on('handleBroadcast', function(event, messages) {
        var stype = null;
        var value = null;
        var sval = null;
        var call = null;
        if (messages.hasOwnProperty('call')) {
            call = messages.call;
        }
        if (call && (call === 'segmentMetric')) {
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
            if (messages.hasOwnProperty('segmentMetric')) {
                var value = messages.segmentMetric.value
                var stype = messages.segmentMetric.stype
                var sval = messages.segmentMetric.sval
            }

            $scope.setHeader(stype, sval);
            $scope.getSegmentMetric(value, stype, sval)
            sharedDataService.openLoadingModal('sm');
        }
    });

    $scope.getSegmentMetric = function(ft, ty, val) {
        function getSessionFilter(ft) {
            var rtype = {
                'all': ft,
                'auth_y': {
                    'key': 'authentication_status',
                    'value': 'Y'
                },
                'auth_n': {
                    'key': 'authentication_status',
                    'value': 'N'
                },
                'auth_u': {
                    'key': 'authentication_status',
                    'value': 'U'
                },
                'pay_s': {
                    'key': 'payment_status',
                    'value': 'SUCCESS'
                },
                'pay_f': {
                    'key': 'payment_status',
                    'value': 'FAILURE'
                },
                'pay_u': {
                    'key': 'payment_status',
                    'value': ''
                }
            };
            return rtype[String(ft)] || null
        }
        var tempFilters = getSessionFilter(ft);

        if (ty !== null && val !== null) {
            if (ty.indexOf(',') != -1) {
                ty = "concat(" + ty + ")"
                val = val.replace(',', '');
            }
            var fv = {
                'key': ty,
                'value': val
            };
            var filterData = [];
            angular.copy($scope.filter, filterData);
            filterData.push(fv)
            if (tempFilters === 'all') {
                $scope.loadData($scope.client, $scope.from, $scope.to, filterData);
            } else if (tempFilters !== null) {
                filterData.push(tempFilters)
                $scope.loadData($scope.client, $scope.from, $scope.to, filterData);
            }
        }
    }

    $scope.setHeader = function(ty, val) {
        var title, value;
        title = ty.replace(/_/g, " ").toTitleCase();
        value = val;
        $scope.header = title + ": " + value;
    }

    $scope.openSegmentMetricModal = function(size, rows, header, filterData) {

        var modalInstance = $modal.open({
            templateUrl: 'segmentMetricModalContent.html',
            controller: 'SegmentMetricModalInstanceCtrl',
            windowClass: 'segment-modal-window',
            scope: $scope,
            resolve: {
                all_row: function() {
                    return rows;
                },
                header: function() {
                    return header;
                },
                filterData: function() {
                    return filterData;
                }
            }
        });

        modalInstance.result.then(function() {}, function() {
            // cleaning the chart object
            d3.select("#chart3 svg").remove();
            d3.select("#chart4").remove();
            //d3.select("#chart5").remove();
            if (nv.graphs[nv.graphs.length - 1].container.id === "chart4")
                nv.graphs.pop();
            if (nv.graphs[nv.graphs.length - 1].container.id === "chart3_svg")
                nv.graphs.pop();
            // if (nv.graphs[nv.graphs.length-1].container.id === "chart5")
            //     nv.graphs.pop();
        });
    };
}


function LoadingModalInstanceCtrl($scope, $modalInstance) {
    $scope.ok = function() {
        $modalInstance.close();
    };

    $scope.cancel = function() {
        $modalInstance.dismiss('cancel');
    };
}

function SegmentMetricModalInstanceCtrl($scope, $modalInstance, $filter, all_row, header, filterData, sharedDataService) {

    $scope.header = header;
    $scope.totalDropCount = 0;
    $scope.date = new Date();
    var ses1 = 0,
        ses2 = 0,
        ses3 = 0,
        tot1 = 0,
        tot2 = 0,
        tot3 = 0;
    for (var val in all_row.AllData) {
        var days = Date.daysBetween((new Date(all_row.AllData[val].x)), ($scope.date));
        if (days < 7) {

            tot1 += all_row.AllData[val].session;
            ses1 += all_row.AllData[val].succpay;
        } else if (days < 30) {
            tot2 += all_row.AllData[val].session;
            ses2 += all_row.AllData[val].succpay;
        } else if (days < 90) {
            tot3 += all_row.AllData[val].session;
            ses3 += all_row.AllData[val].succpay;
        }
    }



    $scope.report = {
        "07": ses1 / tot1 * 100,
        "30": (ses1 + ses2) / (tot1 + tot2) * 100,
        "90": (ses1 + ses2 + ses3) / (tot1 + tot2 + tot3) * 100
    }; // Setting success rate

    loadSegmentMetricGraph(all_row.AllData, getSelectedData); // Loading crossfilter chart for segment Metric
    $scope.errors = true;
    //for pie chart
    $scope.loadData = function(filterData) {
        sharedDataService.loadData('/bq/dropoutReasons', filterData, 'dropReasonLoader', 'dropReasonTab', function(dataResponse, status) {
            $scope.rows = dataResponse;
            if (dataResponse === null || dataResponse === 'null')
                $scope.errors = true;
            else {
                $scope.errors = false;
                loadDropoutReasonChart(filterPieChartData(dataResponse.AllData));
                setMetricChartInstance();
            }
        });
    };
    $scope.startDate = new Date(filterData.from).getTime();
    $scope.endDate = new Date(filterData.to).getTime();

    //called on brush click
    function getSelectedData(e) {
        $scope.selectedExtent = "05";
        $scope.startDate = e.extent[0];
        $scope.endDate = e.extent[1];
        var newData = null;
        if ($scope.rows != null)
            newData = filterPieChartData($scope.rows.AllData);
        if (newData != null) {
            d3.select("#chart4").datum(newData); // Updating Pie chart data
        }
        if ($scope.pieChart == null) {
            setPieChartInstance();
        }
        if ($scope.pieChart != null) {
            $scope.pieChart.update(); // Updating Pie chart
        }
    }

    function filterPieChartData(data) {
        var filterData = [];
        $scope.totalDropCount = 0;
        for (var value in data) {
            var f = 0;
            if (data[value].x > $scope.startDate && data[value].x < $scope.endDate) {
                for (var temp in filterData) {
                    if (filterData[temp].key === data[value].reason) {
                        filterData[temp].y = parseInt(filterData[temp].y) + parseInt(data[value].count);
                        $scope.totalDropCount = parseInt($scope.totalDropCount) + parseInt(data[value].count);
                        f = 1;
                    }
                }
                if (f == 0) {
                    filterData.push({
                        key: data[value].reason,
                        y: data[value].count
                    });
                    $scope.totalDropCount = parseInt($scope.totalDropCount) + parseInt(data[value].count);
                }
            }
        }
        $scope.table_rows = filterData.sort(function(a, b) {
            return b.y - a.y
        });
        return filterData;
    }
    $scope.ok = function() {
        $modalInstance.close();
    };

    $scope.cancel = function() {
        $modalInstance.dismiss('cancel');
    };

    $scope.selectedExtent = "90";
    $scope.graph = null;
    $scope.pieChart = null;
    $scope.changeExtent = function(key) {
        var start, end = new Date().getTime();
        start = start = (new Date(new Date().setDate(new Date().getDate() - parseInt(key)))).getTime();
        setMetricChartInstance();
        if ($scope.graph != null) {
            $scope.graph.brushExtent([start, end]);
            $scope.graph.update();
        }
        $scope.selectedExtent = key;
    }

    $scope.changeActive = function(key) {
        if ($scope.selectedExtent === key)
            return true;
        else
            return false;
    }

    $scope.loadData(filterData); // loading Pie chart

    function setMetricChartInstance() {
        if ($scope.graph == null) {
            for (var i = 0; i < nv.graphs.length; i++) {
                if (nv.graphs[i].container && (nv.graphs[i].container.id === "chart3_svg")) {
                    $scope.graph = nv.graphs[i];
                    $scope.graph.dispatch.on('brush', getSelectedData);
                }
            }
        }
    }

    function setPieChartInstance() {
        if ($scope.pieChart == null) {
            for (var i = 0; i < nv.graphs.length; i++) {
                if (nv.graphs[i].container && (nv.graphs[i].container.id === "chart4")) {
                    $scope.pieChart = nv.graphs[i];
                }
            }
        }
    }
}




function SearchIdController($scope, $http, sharedDataService) {


    $scope.addAlert = function(mssg) {
        $scope.alerts.push({
            type: 'info',
            msg: mssg
        });
    };

    $scope.closeAlert = function(index) {
        $scope.alerts.splice(index, 1);
    };


    $scope.searchId = function() {
        $scope.loading = true;
        $scope.sessData = [];
        $scope.alerts = [];
        //fromandtodate in format October 5,2015 - October 6,2015
        var fromandto = angular.element(document.querySelector('#reportr')).context.innerText;
        var params = {
            "txn_id": $scope.parent.textareaValue.trim(),
            "dates": fromandto,
            "client_id": getCookies().client
        };
        var result = $http({
            url: '/bq/searchId',
            method: "POST",
            data: params,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getCookies().access_token
            }
        }).
        success(function(data) {
            $scope.sessData = data;
            $scope.loading = false;
        }).
        error(function(data) {
            $scope.addAlert("Please Check The Order Id And Date")
            $scope.loading = false;

        });
    }
}






