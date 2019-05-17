'use strict';

/* Services */
function getCookie(key) {
    var name = key + "=";
    var cookie = document.cookie.split(';');
    for(var i=0; i<cookie.length; i++) {
        var c = cookie[i];
        while (c.charAt(0) == ' ')
            c = c.substring(1);
        if (c.indexOf(name) == 0)
            return c.substring(name.length,c.length);
    }
    return "";
}

function delCookie (key) {
    document.cookie = key + '=;expires=Thu, 01 Jan 1970 00:00:01 GMT;';
};

function getState() {

    if (getCookie('email') == null || getCookie('email') == ""){
        return '{"client":"" ,"dimension":"" ,"from":"" ,"to":"","toggle_state":"","time_format":"" ,"show_lines":[false,false,true,true,false,false,false]}'
    }
    // set initial state
    if (getCookie(getCookie('email')) == null || getCookie(getCookie('email')) == "") {
        var str;
        if(getCookie('email')) {
            if(getCookie('client'))
                str = '{"client":"' + getCookie('client').replace(/\"/g, '') +
                        '" ,"dimension":"" ,"from":"" ,"to":"","toggle_state":"","time_format":"","show_lines":[false,false,true,true,false,false,false]}';
            else
                str = '{"client":"" ,"dimension":"" ,"from":"" ,"to":"","toggle_state":"","time_format":"","show_lines":[false,false,true,true,false,false,false]}';
            document.cookie = getCookie('email') + '=' + str
        }
    }
    return JSON.parse((getCookie(getCookie('email').replace(/'/g,"\""))).replace('\\054',','))

}

function updateState(state) {
    document.cookie = getCookie('email') + '=' + JSON.stringify(state)
}

function formatDate(d) {
    var dd = d.getDate();
    if ( dd < 10 ) dd = '0' + dd
        var mm = d.getMonth()+1
    if ( mm < 10 ) mm = '0' + mm
        var yy = d.getFullYear()
    if ( yy < 10 ) yy = '0' + yy
        return yy+'/'+mm+'/'+dd
}

var shared = angular.module('GodelDashboard');

var state  = getState();
var where = "", prefs = [];

if (getCookie(getCookie('email')) == null || getCookie(getCookie('email')) == "" ||
        state['from'] == null || state['from'] == "")
    {var from = formatDate(new Date(new Date().setDate(new Date().getDate() - 6)));
    //var from = new Date(new Date().setDate(new Date().getDate() - 6)).getTime();
} else {
    var from = state['from'];
}

if (getCookie(getCookie('email')) == null || getCookie(getCookie('email')) == "" ||
        state['to'] == null || state['to'] == "") {
    var to = formatDate(new Date());
    //var to = new Date().getTime()
} else{
    var to = state['to'];
}

if (getCookie(getCookie('email')) == null || getCookie(getCookie('email')) == "" ||
        state['client'] == null || state['client'] == "") {
    var merchant = 'null'; // Default client
} else {
    var merchant = state['client'];
}


if (new Date(to) > new Date ('2016-06-02')){

    var defaultFilter = [{"key": "coalesce(is_supported, payment_instrument_group)",
        "value": ["T", "card", "netbanking", "credit card", "debit card"]}];
    if (getCookie(getCookie('email')) == null || getCookie(getCookie('email')) == "" ||
            state['toggle_state'] == null || state['toggle_state'] == "") {
        //default filter
    }
    else {
        if (state['toggle_state'] == 'Left') {
            var defaultFilter = []
        }
        if (state['toggle_state'] == 'Right') {
            var defaultFilter = [{"key": "coalesce(is_supported, payment_instrument_group)", "value": ["F", "unknown"]}]
        }
    }

} else {
    var defaultFilter = [{"key":"payment_instrument_group", "value": ["card", "netbanking", "credit card", "debit card"]}];
    if (getCookie(getCookie('email')) == null || getCookie(getCookie('email')) == "" ||
            state['toggle_state'] == null || state['toggle_state'] == "") {
        //default filter
    }
    else {
        if (state['toggle_state'] == 'Left') {
            var defaultFilter = []
        }
        if (state['toggle_state'] == 'Right') {
            var defaultFilter = [{"key": "payment_instrument_group", "value": ["unknown"]}]
        }
    }

}


var data = {'email':"",'role':"",'appname':""};

var getCookies = function() {
    var pairs = document.cookie.split(";");
    var cookies = {};
    for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i].split("=");
        cookies[pair[0]] = unescape(pair[1]);
    }
    return cookies;
}

shared.directive('linearChart', function($parse, $window) {
   return {
      restrict:'EA',
      template:"<svg width='50' height='20' style='height:20px;width:40px;'></svg>",
      link: function(scope, elem, attrs) {
        var exp = $parse(attrs.chartData);
        var dataToPlot = exp(scope);
        var exp2 = $parse(attrs.typespan);
        if (dataToPlot == null) {
            return
        }
        var data = dataToPlot.split(",");
        for (var itr in data) {
            data[itr] = +data[itr];
        }
           // data=data.reverse();
           var padding = 20;
           var pathClass = "path";
           var d3 = $window.d3;
           var rawSvg=elem.find('svg');
           var svg = d3.select(rawSvg[0]);

           function drawLineChart() {
            var graph = svg;
            if (exp2(scope) == "7") {
                graph.attr("style","height:20px;width:20px;")
            }
            var x = d3.scale.linear().domain([0, 100]).range([0, 300]);
            var y = d3.scale.linear().domain([0, 100]).range([20, 0]);
            var xAxis = d3.svg.axis().scale(x).orient("bottom").ticks(5);
            var yAxis = d3.svg.axis().scale(y).orient("left").ticks(5).tickFormat("-");
            var line = d3.svg.line()

            .x(function(d,i) {
                //console.log('Plotting X value for data point: ' + d + ' using index: ' + i + ' to be at: ' + x(i) + ' using our xScale.');
                return x(i);
            })
            .y(function(d) {
                //console.log('Plotting Y value for data point: ' + d + ' to be at: ' + y(d) + " using our yScale.");
                return y(d);
            })

            graph.append("svg:g")
            .attr("class", "x1 axis")
            .attr("transform", "translate(0,180)")
            .call(xAxis);

            graph.append("svg:g")
            .attr("class", "y1 axis")
            .attr("transform", "translate(20,0)")
            .call(yAxis);

            graph.append("svg:path")
            .attr("d", line(data))
            .attr("stroke", "steelblue")
            .attr("stroke-width", 1)
            .attr("fill", "none");
        }
        drawLineChart();
    }
};
});

shared.factory('role',function($http) {
    var sharedRole = {};
    sharedRole.getRole = function(callbackFunc) {
        var params = {}
        $http({
            url: '/users/navbar',
            method: "POST",
            data: params,
            headers: {'Content-Type': 'application/json', 'Authorization': getCookies()["access_token"]}
        }).
        success(function(data) {
            var role = data.split("\"")[1];
            document.cookie = 'role=' + role;
            callbackFunc(role);

        }).
        error(function(data) {
            callbackFunc(null);

        });
    }
    return sharedRole;
})

shared.factory('sharedDataService', function($rootScope,$http, $modal) {
    var sharedService = {};
    sharedService.prepForBroadcast = function(msgtemp) {
        this.broadcastItem(msgtemp);
    };

    sharedService.broadcastItem = function(msgtemp) {
        $rootScope.$broadcast('handleBroadcast',msgtemp);
    };

    sharedService.loadData = function(url,params,spinnerSelector,elementSelector,callbackFunc) {
        startSpinner(spinnerSelector,elementSelector);
        $http({
            url: url,
            method: "POST",
            data: params,
            headers: {'Content-Type': 'application/json', 'Authorization': getCookies()["access_token"]}
        }).
        success(function(data ,status) {
            stopSpinner(spinnerSelector,elementSelector);
            callbackFunc(data,status);
        }).
        error(function (data,status) {
            callbackFunc(null,status);
        });
    }

    function startSpinner(spinnerSelector,elementSelector) {
        $("#"+spinnerSelector ).show();
        $("#"+elementSelector ).hide();
    }

    function stopSpinner(spinnerSelector,elementSelector) {
        $("#"+spinnerSelector ).hide();
        $("#"+elementSelector ).show();
    }

    sharedService.loadingModal=null;
    sharedService.openLoadingModal = function (size) {

        sharedService.loadingModal = $modal.open({
            templateUrl: 'loadingModalContent.html',
            controller: 'LoadingModalInstanceCtrl',
            keyboard : false,
            backdrop : 'static',
            size : size
        });

    };

    sharedService.closeLoadingModal = function()
    {
        sharedService.loadingModal.close();
    }

    return sharedService;
});

shared.service('sortService', function($rootScope) {

    this.selectedCls = function(sort,column) {

        return column == sort.column && 'sort-' + sort.descending;
    }

    this.changeSorting = function(sort,column) {
        if (sort.column == column) {
            sort.descending = !sort.descending;
        } else {
            sort.column = column;
            sort.descending = false;
        }
        //return sort;
    }

});

shared.factory('$blob', function() {
    return {
        csvToURL: function(content) {
            var blob;
            blob = new Blob([content], {type: 'text/csv'});
            return (window.URL || window.webkitURL).createObjectURL(blob);
        },
        sanitizeCSVName: function(name) {
            if (/^[A-Za-z0-9]+\.csv$/.test(name)) {
                return name;
            }
            if (/^[A-Za-z0-9]+/.test(name)) {
                return name + ".csv";
            }
            throw new Error("Invalid title fo CSV file : " + name);
        },
        revoke: function(url) {
            return (window.URL || window.webkitURL).revokeObjectURL(url);
        }
    };
});

shared.factory('$click', function() {
    return {
        on: function(element) {
            var e = document.createEvent("MouseEvent");
            e.initMouseEvent("click", false, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
            element.dispatchEvent(e);
        }
    };
});

shared.directive('downloadCsv', function($parse, $click, $blob, $log, $timeout) {
    return {
        compile: function($element, attr) {
            var fn = $parse(attr.downloadCsv);

            return function(scope, element, attr) {

                element.on('click', function(event) {
                    var a_href, content, title, url, _ref;
                    _ref = fn(scope), content = _ref.content, title = _ref.title;

                    if (!(content != null) && !(title != null)) {
                        $log.warn("Invalid content or title in download-csv : ", content, title);
                        return;
                    }

                    title = $blob.sanitizeCSVName(title);
                    url = $blob.csvToURL(content);

                    element.append("<a download=\"" + title + "\" href=\"" + url + "\"></a>");
                    a_href = element.find('a')[0];

                    $click.on(a_href);
                    $timeout(function() {$blob.revoke(url);});

                    element[0].removeChild(a_href);
                });
            };
        }
    };
});
