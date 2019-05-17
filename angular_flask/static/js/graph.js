// Includes
// $("head").append('<script type="text/javascript" src="/static/lib/graph/d3.v3.js"></script>');
// $("head").append('<script type="text/javascript" src="/static/lib/graph/nv.d3.js"></script>');
// $("head").append('<script type="text/javascript" src="/static/lib/graph/utils.js"></script>');
// $("head").append('<script type="text/javascript" src="/static/lib/graph/tooltip.js"></script>');
// $("head").append('<script type="text/javascript" src="/static/lib/graph/legend.js"></script>');
// $("head").append('<script type="text/javascript" src="/static/lib/graph/axis.js"></script>');
// $("head").append('<script type="text/javascript" src="/static/lib/graph/scatter.js"></script>');
// $("head").append('<script type="text/javascript" src="/static/lib/graph/line.js"></script>');
// $("head").append('<script type="text/javascript" src="/static/lib/graph/lineChart.js"></script>');
// $("head").append('<script type="text/javascript" src="/static/lib/graph/interactiveLayer.js"></script>');
// $("head").append('<script type="text/javascript" src="/static/lib/graph/stackedArea.js"></script>');
// $("head").append('<script type="text/javascript" src="/static/lib/graph/stackedAreaChart.js"></script>');
// $("head").append('<script type="text/javascript" src="/static/lib/graph/stream_layers.js"></script>');
// $("head").append('<script type="text/javascript" src="/static/lib/graph/godelCustomLineWithFocusChart.js"></script>');
// $("head").append('<script type="text/javascript" src="/static/lib/graph/crossfilter.js"></script>');
// $("head").append('<script type="text/javascript" src="/static/lib/graph/pie.js"></script>');
// $("head").append('<script type="text/javascript" src="/static/lib/graph/pieChart.js"></script>');
// $("head").append('<script src="https://cdnjs.cloudflare.com/ajax/libs/angular-google-chart/0.1.0/ng-google-chart.js" type="text/javascript"></script>');
// $("head").append('<script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>');


function dataColor(title) {
    switch (title) {
        case 'Failure':
            return '#bb4433';
        case 'Success':
            return '#339900';
        case 'Sessions':
            return '#777777';
        case 'AuthPay':
            return '#738678';
    }
    return '#FFFF00';
}

function makerows(rows) {

    var data = [];
    var succ_tot = 0;
    var fail_tot = 0;
    for (var itr in rows) {
        var tmp = {}
        tmp = {
            c: [{
                v: new moment(itr)._d
            }, {
                v: rows[itr][0]['succ_cnt']
            }, {
                v: rows[itr][0]['fail_cnt']
            }]
        }
        data.push(tmp);
        succ_tot += rows[itr][0]['succ_cnt'];
        fail_tot += rows[itr][0]['fail_cnt'];

    }

    return [data, succ_tot, fail_tot];
}

function makecsv(rows) {
    var data = [];
    var innerdata = [];
    for (var itr in rows) {
        innerdata = [new moment(itr)._d, rows[itr][0]['succ_cnt'], rows[itr][0]['fail_cnt'],
            rows[itr][0]['succ_rate'], rows[itr][0]['session_cnt'], rows[itr][0]['is_godel'],rows[itr][0]['otp_lat'],
            rows[itr][0]['sess_lat']
        ];

        data.push(innerdata);
    }
    return data
}


function countChart(rows) {

    var chartObj = {};
    // chartObj.type = 'AnnotatedTimeLine';
    // chartObj.type = 'AreaChart';
    chartObj.type = "AnnotationChart";

    chartObj.data = {
        "cols": [{
            id: 'd',
            label: 'dt',
            type: 'datetime'
        }, {
            id: 's',
            label: 'Success',
            type: 'number'
        }, {
            id: 'f',
            label: 'Failure',
            type: 'number'
        }],
        'rows': rows
    };


    chartObj.options = {
        colors: ['#0072BB', '#FF4C3B'],
        fill: 25,
        wmode: 'transparent',
        thickness: 1.5,
        displayExactValues: true,
        annotationsWidth: 5,
        displayAnnotations: false,
        vAxis: {

            gridlines: {
                color: 'transparent'
            }
        }


    };

    return chartObj;
}


function doDygraph(csvrows,eleId) {
    var dydata = "dt,Success,Failure,Success rate,Sessions,Godel Coverage,Median OTP latency(s),Median session latency(s)" + "\n" + csvrows.join("\n")
    var legendDivWidth = '100%';
    var state = getState();
    setTimeout(function() {
        chart = new Dygraph(
            document.getElementById(eleId), dydata, {
                // title: "Succ Vs Fail Count",
                //visibility: [true, true, true, true],
                // stackedGraph: true,
                highlightCircleSize: 2,
                // strokeWidth: 0.1,
                // strokeBorderWidth: 2,
                // rangeSelectorHeight: 30,
                // showRangeSelector: true,
                // labelsDiv:"legendDiv",
                // legend:'follow',
                xAxis: {
                type: 'datetime',
                tickPixelInterval: 150
            },
                fillGraph: true,
                fillAlpha: 0.5,
                labelsDivStyles: {
                    'text-align': 'right',
                    'right': '60px',
                    'font-size': '9px',
                    // 'top': '-10px',
                    'background-color': 'white'
                },
                labelsDivWidth: legendDivWidth,
                animatedZooms: true,
                gridLineColor: '#cccccc',
                colors: ['#47b8e0', '#ff7473', '#09B900', '#ACACAC','#7189ea', '#9055A2', '#F17F42'],
                visibility: state['show_lines'],
                zoomCallback: function(minX, maxX, $scope) {
                    var appElement = document.querySelector('[ng-app=GodelDashboard]');
                    var $scope = angular.element(appElement).scope();
                    $scope.newStartE = minX;
                    $scope.newEndE = maxX;
                },
                series: {
                    'Success': {
                        color: '#47b8e0',
                        fillGraph: true,
                        strokeWidth: 0.5, // Y1 gets a special value.
                    },
                    'Failure': {
                        color: '#ff7473',
                        fillGraph: true,
                        strokeWidth: 0.5,
                    },
                    'Success rate': {
                        color: '#09B900',
                        fillGraph: false,
                        strokeWidth: 1,
                        rollPeriod: 1,
                        strokeBorderWidth: 3,
                        showRoller: true,
                        axis: 'y2' // so does Y3.

                    },
                    'Sessions': {
                        color: '#ACACAC',
                        fillGraph: true,
                        strokeWidth: 0.5, // Y1  otgets a special value.
                    },
                    'Godel Coverage': {
                        color: '#7189ea',
                        fillGraph: false,
                        strokeWidth: 1,
                        strokeBorderWidth: 3,
                        axis: 'y2',

                    },
                    'Median OTP latency(s)': {
                        color: '#9055A2',
                        fillGraph: false,
                        strokeWidth: 1,
                        strokeBorderWidth: 3,
                        axis: 'y2',

                    },
                    'Median session latency(s)': {
                        color: '#F17F42',
                        fillGraph: false,
                        strokeWidth: 1,
                        strokeBorderWidth: 3,
                        axis: 'y2'
                    }
                },
                axes: {
                    y2: {

                    }
                }
            }

        );
    }, 0);

}

function changevizof(eveId, eveChecked) {
    chart.setVisibility(eveId, eveChecked);
}

function nvd3Donut(succ,fail){
// resetting svg node
var svgNode = document.getElementById("donutsvg");
while (svgNode.firstChild) {
    svgNode.removeChild(svgNode.firstChild);
}
var total = 0;
var succ_rate = 0;
var pieData = [
    {
      "label": "SUCCESS",
      "value": parseInt(succ)
    },
    {
      "label": "FAILURE",
      "value": parseInt(fail)
    }];

pieData.forEach(function (d) {
    total = total + d.value;
});
succ_rate = parseInt( succ / total * 100);

var tp = function(key, y, e, graph) {
    dim_cnt =  parseFloat(y.replace(',',''));
    rate =  parseFloat((dim_cnt/total) * 100).toFixed(2);
    return '<p>' + key +': '+ rate+'%<br># ' +  dim_cnt+'</p>' ;
};


nv.addGraph(function() {
  var donutChart = nv.models.pieChart()
      .x(function(d) {
        return d.label
      })
      .y(function(d) {
        return d.value
      })
      .showLabels(false)
      .showLegend(false)
      .labelThreshold(.05)
      .labelType("key")
      .color(['#47b8e0', '#ff7473'])
      .tooltipContent(tp) // This is for when I turn on tooltips
      .tooltips(true)
      .donut(true)
      .donutRatio(0.6);

    function centerText() {
      return function() {
        var svg = d3.select("#donutsvg");
        var donut = svg.selectAll("g.nv-slice").filter(
          function (d, i) {
            return i == 0;
          }
        );
        
        // Insert first line of text into middle of donut pie chart
        donut.insert("text", "g")
            .text(succ_rate)
            .attr("class", "middle")
            .attr("text-anchor", "middle")
            .attr("dy", "0")
            .attr("id","perc_succ")
            .style("fill","#47b8e0")
            .style("font-size","30pt")
            .style("font-color","#79BEDB");

        // Insert second line of text into middle of donut pie chart
        donut.insert("text", "g")
            .text('# ' +total)
            .attr("class", "middle")
            .attr("id","total")
            .attr("text-anchor", "middle")
            .attr("dy", "1.5em")
            .style("fill", "#000")
            .style("font-size","14pt");
      }
    }
  
  // Put the donut pie chart together
  d3.select("#donutchart svg")
    .datum(pieData)
    .transition().duration(1200)
    .call(donutChart)
    .call(centerText());
  return donutChart;
});
}




function donutpie(succ, fail) {

    var chartObjects = {};
    chartObjects.type = "PieChart";



    chartObjects.data = {
        "cols": [{
            id: "t",
            label: "Topping",
            type: "string"
        }, {
            id: "s",
            label: "Slices",
            type: "number"
        }],
        "rows": [{
                c: [{
                    v: "Success"
                }, {
                    v: succ
                }]
            }, {
                c: [{
                    v: "Failure"
                }, {
                    v: fail
                }]
            },

        ]
    };

    chartObjects.options = {
        height: '100%',
        width: '100%',
        pieHole: 0.75,
        pieSliceText: 'none',
        backgroundColor: 'transparent',

        animation: {
            easing: 'inAndOut',
            duration: 1000,
            startup: true

        },

        legend: {
            position: 'none',

        },
        colors: ['4ea1d3', 'ff7473'],
        chartArea: {
            left: 10,
            top: 10,
            width: '90%',
            height: '90%'
        },

        tooltip: {
            text: 'value',
            trigger: 'focus',
            textStyle: {
                fontSize: '10px'
            }
        },
    };

    return chartObjects;
}

var lineData;



function loadGraph(graphData, type, from, role) {
    lineData = graphData;
    var fullGraphData = JSON.parse(JSON.stringify(graphData));
    fullGraphData.map(function(line) {
        line.values = line.values.map(function(d) {
            return {
                x: d[0],
                y: d[1]
            }
        });
        line.color = dataColor(line.key);
        line.area = true;
        return line;
    });
    fullGraphData = util.sortByOrder(fullGraphData, ['Sessions', 'Failure', 'Success'], function(line) {
        return line.key;
    })

    var successFailureGraphData = JSON.parse(JSON.stringify(graphData));

    function sortByName(a, b) {
        var sortStatus = 0;
        if (a.key < b.key) {
            sortStatus = 1;
        } else if (a.key > b.key) {
            sortStatus = -1;
        }
        return sortStatus;
    }
    for (var key in successFailureGraphData) {
        if (successFailureGraphData[key].key != "Success" && successFailureGraphData[key].key != "Failure")
            successFailureGraphData.splice(key, 1);
    }
    successFailureGraphData = util.sortByOrder(successFailureGraphData, ['Success', 'Failure'], function(line) {
        return line.key;
    })
    var isJuspay = ['Super', 'Admin', 'Juspay'].indexOf(role) > -1;
    defaultChartConfig("chart1", fullGraphData, type, from, true); // setting authenticated == true always
    successFailureChart("chart2", successFailureGraphData, type);

}

function loadSegmentMetricGraph(graphData, onBrushChange) {
    var data = new Array(5)
    var formData = []
    data[0] = new Array();
    data[1] = new Array();
    data[2] = new Array();

    for (var val in graphData) {
        data[0].push({
            series: 0,
            x: graphData[val].x,
            y: 100
        });
        data[1].push({
            series: 1,
            x: graphData[val].x,
            y: graphData[val].succpay / graphData[val].session * 100
        });
        data[2].push({
            series: 2,
            x: graphData[val].x,
            y: graphData[val].authpay / graphData[val].session * 100
        });
    }

    formData.push({
        color: "#ff7f0e",
        key: "Session",
        seriesIndex: 0,
        values: data[0],
        area: false
    })
    formData.push({
        color: "#7777ff",
        key: "Auth Success",
        seriesIndex: 1,
        values: data[2],
        area: true
    })
    formData.push({
        color: "#2ca02c",
        key: "Payment Success",
        seriesIndex: 2,
        values: data[1],
        area: true
    })
    lineWithCrossFilter("chart3", formData, onBrushChange);
}

function defaultChartConfig(containerid, data, type, from, authenticated) {
    var auxOptions = {};
    var guideline = true;
    var useDates = true;
    nv.addGraph(function() {
        var chart;
        $('#timeController').css('display', 'none');
        if (type == "days") {
            $('.chart_svg').css('height', '190');
            $('#timeController').css('display', 'none');
        } else if (authenticated && type == 'hours') {
            $('#timeController').css('display', 'inline');
            $('.chart_svg').css('height', '250');
        }

        chart = nv.models.lineWithFocusChart().useInteractiveGuideline(guideline);
        chart.height(250);
        chart.x(function(d, i) {
            return d.x;
        });
        if (auxOptions.width)
            chart.width(auxOptions.width);
        if (auxOptions.height)
            chart.height(auxOptions.height);
        if (auxOptions.forceY)
            chart.forceY([0]);
        var formatter;
        if (useDates !== undefined) {
            formatter = function(d, i) {
                if (type == 'hours')
                    return d3.time.format('%H')(new Date(0, 0, 0, parseInt(d), 0, 0, 0)) + ":00";
                else
                    return d3.time.format('%b %d %Y')(new Date(d));
            }
        } else {
            formatter = d3.format(",.1f");
        }
        chart.margin({
            right: 40
        });
        chart.xAxis
            .tickFormat(
                formatter
            );
        //modified for x2 axis
        chart.x2Axis
            .tickFormat(
                formatter
            );

        chart.yAxis
            .tickFormat(d3.format('.0f'));
        d3.select('#' + containerid + ' svg')
            .datum(data)
            .transition().duration(0)
            .call(chart);
        d3.select('#' + containerid + ' svg g')
            .attr('transform', 'translate(50,30)');
        // nv.utils.windowResize(chart.update);
        nv.utils.windowResize(function() {
            d3.select('#' + containerid + ' svg')
                .datum(data)
                .transition().duration(0)
                .call(chart);
            d3.select('#' + containerid + ' svg g')
                .attr('transform', 'translate(50,30)');
            chart.update();
            if (type == "days") {
                $('#timeController').css('display', 'none');
            } else if (authenticated && type == 'hours') {
                $('#timeController').css('display', 'inline');
            }
        });
        chart.dispatch.on('brush', function(b, $scope) {
            //Callback Function
            if (authenticated && type == 'hours') {
                $('#timeController').css('display', 'inline');
                var fa = b.extent[0];
                var fb = b.extent[1];
                var fromTimef = ("0" + (Math.floor(fa))).slice(-2) + ":" + ("0" + (Math.round((fa % 1) * 60))).slice(-2) + ":" + ("0" + (Math.round(((fa % 1) * 3600) % 60))).slice(-2);
                var toTimef = ("0" + (Math.floor(fb))).slice(-2) + ":" + ("0" + (Math.round((fb % 1) * 60))).slice(-2) + ":" + ("0" + (Math.round(((fb % 1) * 3600) % 60))).slice(-2);
                var appElement = document.querySelector('[ng-app=GodelDashboard]');
                var $scope = angular.element(appElement).scope();
                $scope.$apply(function() {
                    $scope.fromLine = b.extent[0];
                    $scope.toLine = b.extent[1];
                    $scope.fromTime = from.substr(0, 10) + "_" + fromTimef;
                    $scope.toTime = from.substr(0, 10) + "_" + toTimef;
                });
            } else {
                $('#timeController').css('display', 'none');
            }
        });

        // chart.dispatch.on('stateChange', function(e) { nv.log('New State:', JSON.stringify(e)); });
        $("#chart1").trigger("click");
        return chart;
    });
}

function successFailureChart(containerid, data, type) {
    keyColor = function(d, i) {
        return dataColor(d.key)
    };
    var chart;
    nv.addGraph(function() {
        chart = nv.models.stackedAreaChart()
            // .width(600).height(500)
            .useInteractiveGuideline(true)
            .x(function(d) {
                return d[0]
            })
            .y(function(d) {
                return d[1]
            })
            .color(keyColor)
            .transitionDuration(300).style('expand');
        //.clipEdge(true);
        chart.height(250);

        // chart.stacked.scatter.clipVoronoi(false);
        chart.xAxis
            .tickFormat(function(d) {
                if (type == 'hours')
                    return d3.time.format('%H')(new Date(0, 0, 0, parseInt(d), 0, 0, 0)) + ":00";
                else
                    return d3.time.format('%b %d %Y')(new Date(d));
            });
        chart.yAxis
            .tickFormat(d3.format(',.2f'));
        d3.select('#' + containerid + ' svg')
            .datum(data)
            .transition().duration(1000)
            .call(chart);
        d3.select('#' + containerid + ' svg g')
            .attr('transform', 'translate(50,30)');
        nv.utils.windowResize(function() {
            d3.select('#' + containerid + ' svg')
                .datum(data)
                .transition().duration(1000)
                .call(chart);
            d3.select('#' + containerid + ' svg g')
                .attr('transform', 'translate(50,30)');
            chart.update();

        });
        // chart.dispatch.on('stateChange', function(e) { nv.log('New State:', JSON.stringify(e)); });
        return chart;
    });
}

function lineWithCrossFilter(containerid, data, onBrushChange) {
    nv.addGraph(function() {
        var chart = nv.models.lineWithFocusChart();

        chart.xAxis
            .tickFormat(function(d) {
                return d3.time.format('%b %d %Y')(new Date(d))
            });
        chart.x2Axis
            .tickFormat(function(d) {
                return d3.time.format('%b %Y')(new Date(d))
            });
        chart.yAxis
            .tickFormat(function(d) {
                return d3.format(',f')(d) + "%"
            });
        chart.y2Axis
            .tickFormat(function(d) {
                return d3.format(',f')(d) + "%"
            });
        chart.dispatch.on('brush', onBrushChange);

        d3.select('#' + containerid + ' svg')
            .datum(data)
            .transition().duration(500)
            .call(chart);
        d3.select('#' + containerid + ' svg g')
            .attr('transform', 'translate(40,30)');
        return chart;
    });
}

function loadDropoutReasonChart(data) {
    pieChart('chart4', data);
}

function pieChart(containerid, data) {
    nv.addGraph(function() {
        var chart = nv.models.pieChart()
            .x(function(d) {
                return d.key
            })
            .y(function(d) {
                return d.y
            })
            .color(d3.scale.category10().range())
            .showLegend(false).showLabels(true).donut(true)
            .height(300)
            .labelThreshold(.05) //Configure the minimum slice size for labels to show up
            .labelType("percent") //Configure what type of data to show in the label. Can be "key", "value" or "percent"
            .donut(true) //Turn on Donut mode. Makes pie chart look tasty!
            .donutRatio(0.35); //Configure how big you want the donut hole size to be.

        chart.valueFormat(d3.format(',.f'))
        chart.tooltipContent(function(key, y, e, graph) {
            var total = 0;
            for (var d in graph.container.__data__)
                total = parseInt(total) + parseInt(graph.container.__data__[d].y)
            return '<h6>' + key + '</h6>' +
                '<p>' + y + ' of ' + total + '</p>'
        });
        d3.select("#" + containerid)
            .datum(data)
            .transition().duration(1200)
            .call(chart);

        d3.select('#' + containerid + ' g')
            .attr('transform', 'translate(25,20)');

        d3.select("#" + containerid) //To Add Title
            .append("text")
            .attr("x", 155)
            .attr("y", 30)
            .attr("style", "font-size: 22px;font-family: inherit;fill: gray !important;")
            .attr("text-anchor", "middle")
            .text("Dropout Reason Analysis");
        chart.dispatch.on('stateChange', function(e) {
            nv.log('New State:', JSON.stringify(e));
        });
        return chart;
    });
}

// for NVD3 graphs to refresh on tab change
$(document).on('click', '.tab-pane', function() {
    $(window).trigger('resize');
});


d3.sankey = function() {
    var sankey = {},
        nodeWidth = 24,
        nodePadding = 8,
        size = [1, 1],
        nodes = [],
        links = [],
        // cycle features
        cycleLaneNarrowWidth = 4,
        cycleLaneDistFromFwdPaths = -10, // the distance above the paths to start showing 'cycle lanes'
        cycleDistFromNode = 30, // linear path distance before arcing from node
        cycleControlPointDist = 30, // controls the significance of the cycle's arc
        cycleSmallWidthBuffer = 2 // distance between 'cycle lanes'
    ;

    sankey.nodeWidth = function(_) {
        if (!arguments.length) return nodeWidth;
        nodeWidth = +_;
        return sankey;
    };

    sankey.nodePadding = function(_) {
        if (!arguments.length) return nodePadding;
        nodePadding = +_;
        return sankey;
    };

    // cycle related attributes
    sankey.cycleLaneNarrowWidth = function(_) {
        if (!arguments.length) return cycleLaneNarrowWidth;
        cycleLaneNarrowWidth = +_;
        return sankey;
    }

    sankey.cycleSmallWidthBuffer = function(_) {
        if (!arguments.length) return cycleSmallWidthBuffer;
        cycleSmallWidthBuffer = +_;
        return sankey;
    }

    sankey.cycleLaneDistFromFwdPaths = function(_) {
        if (!arguments.length) return cycleLaneDistFromFwdPaths;
        cycleLaneDistFromFwdPaths = +_;
        return sankey;
    }

    sankey.cycleDistFromNode = function(_) {
        if (!arguments.length) return cycleDistFromNode;
        cycleDistFromNode = +_;
        return sankey;
    }

    sankey.cycleControlPointDist = function(_) {
        if (!arguments.length) return cycleControlPointDist;
        cycleControlPointDist = +_;
        return sankey;
    }

    sankey.nodes = function(_) {
        if (!arguments.length) return nodes;
        nodes = _;
        return sankey;
    };

    sankey.links = function(_) {
        if (!arguments.length) return links;
        links = _;
        return sankey;
    };

    sankey.size = function(_) {
        if (!arguments.length) return size;
        size = _;
        return sankey;
    };

    sankey.layout = function(iterations) {
        computeNodeLinks();
        computeNodeValues();
        markCycles();
        computeNodeBreadths();
        computeNodeDepths(iterations);
        computeLinkDepths();
        return sankey;
    };

    sankey.relayout = function() {
        computeLinkDepths();
        return sankey;
    };

    sankey.link = function() {
        var curvature = .5;

        function link(d) {
            if (d.causesCycle) {
                // cycle node; reaches backward

                /*
      The path will look like this, where
      s=source, t=target, ?q=quadratic focus point
     (wq)-> /-----n-----\
            |w          |
            |           e
            \-t         |
                     s--/ <-(eq)
      */
                // Enclosed shape using curves n' stuff
                var smallWidth = cycleLaneNarrowWidth,

                    s_x = d.source.x + d.source.dx,
                    s_y = d.source.y + d.sy + d.dy,
                    t_x = d.target.x,
                    t_y = d.target.y,
                    se_x = s_x + cycleDistFromNode,
                    se_y = s_y,
                    ne_x = se_x,
                    ne_y = cycleLaneDistFromFwdPaths - (d.cycleIndex * (smallWidth + cycleSmallWidthBuffer)), // above regular paths, in it's own 'cycle lane', with a buffer around it
                    nw_x = t_x - cycleDistFromNode,
                    nw_y = ne_y,
                    sw_x = nw_x,
                    sw_y = t_y + d.ty + d.dy;

                // start the path on the outer path boundary
                return "M" + s_x + "," + s_y +
                    "L" + se_x + "," + se_y +
                    "C" + (se_x + cycleControlPointDist) + "," + se_y + " " + (ne_x + cycleControlPointDist) + "," + ne_y + " " + ne_x + "," + ne_y +
                    "H" + nw_x +
                    "C" + (nw_x - cycleControlPointDist) + "," + nw_y + " " + (sw_x - cycleControlPointDist) + "," + sw_y + " " + sw_x + "," + sw_y +
                    "H" + t_x
                    //moving to inner path boundary
                    +
                    "V" + (t_y + d.ty) +
                    "H" + sw_x +
                    "C" + (sw_x - (cycleControlPointDist / 2) + smallWidth) + "," + t_y + " " +
                    (nw_x - (cycleControlPointDist / 2) + smallWidth) + "," + (nw_y + smallWidth) + " " +
                    nw_x + "," + (nw_y + smallWidth) +
                    "H" + (ne_x - smallWidth) +
                    "C" + (ne_x + (cycleControlPointDist / 2) - smallWidth) + "," + (ne_y + smallWidth) + " " +
                    (se_x + (cycleControlPointDist / 2) - smallWidth) + "," + (se_y - d.dy) + " " +
                    se_x + "," + (se_y - d.dy) +
                    "L" + s_x + "," + (s_y - d.dy);

            } else {
                // regular forward node
                var x0 = d.source.x + d.source.dx,
                    x1 = d.target.x,
                    xi = d3.interpolateNumber(x0, x1),
                    x2 = xi(curvature),
                    x3 = xi(1 - curvature),
                    y0 = d.source.y + d.sy + d.dy / 2,
                    y1 = d.target.y + d.ty + d.dy / 2;
                return "M" + x0 + "," + y0 +
                    "C" + x2 + "," + y0 +
                    " " + x3 + "," + y1 +
                    " " + x1 + "," + y1;
            }
        }

        link.curvature = function(_) {
            if (!arguments.length) return curvature;
            curvature = +_;
            return link;
        };

        return link;
    };

    // Populate the sourceLinks and targetLinks for each node.
    // Also, if the source and target are not objects, assume they are indices.
    function computeNodeLinks() {
        nodes.forEach(function(node) {
            node.sourceLinks = [];
            node.targetLinks = [];
        });
        links.forEach(function(link) {
            var source = link.source,
                target = link.target;
            if (typeof source === "number") source = link.source = nodes[link.source];
            if (typeof target === "number") target = link.target = nodes[link.target];
            source.sourceLinks.push(link);
            target.targetLinks.push(link);
        });
    }

    // Compute the value (size) of each node by summing the associated links.
    function computeNodeValues() {
        nodes.forEach(function(node) {
            node.value = Math.max(
                d3.sum(node.sourceLinks, value),
                d3.sum(node.targetLinks, value)
            );
        });
    }

    // Iteratively assign the breadth (x-position) for each node.
    // Nodes are assigned the maximum breadth of incoming neighbors plus one;
    // nodes with no incoming links are assigned breadth zero, while
    // nodes with no outgoing links are assigned the maximum breadth.
    function computeNodeBreadths() {
        var remainingNodes = nodes,
            nextNodes,
            x = 0;

        while (remainingNodes.length) {
            nextNodes = [];
            remainingNodes.forEach(function(node) {
                node.x = x;
                node.dx = nodeWidth;
                node.sourceLinks.forEach(function(link) {
                    if (!link.causesCycle) {
                        nextNodes.push(link.target);
                    }
                });
            });
            remainingNodes = nextNodes;
            ++x;
        }

        moveSinksRight(x);
        scaleNodeBreadths((size[0] - nodeWidth) / (x - 1));
    }

    function moveSourcesRight() {
        nodes.forEach(function(node) {
            if (!node.targetLinks.length) {
                node.x = d3.min(node.sourceLinks, function(d) {
                    return d.target.x;
                }) - 1;
            }
        });
    }

    function moveSinksRight(x) {
        nodes.forEach(function(node) {
            if (!node.sourceLinks.length) {
                node.x = x - 1;
            }
        });
    }

    function scaleNodeBreadths(kx) {
        nodes.forEach(function(node) {
            node.x *= kx;
        });
    }

    function computeNodeDepths(iterations) {
        var nodesByBreadth = d3.nest()
            .key(function(d) {
                return d.x;
            })
            .sortKeys(d3.ascending)
            .entries(nodes)
            .map(function(d) {
                return d.values;
            });

        initializeNodeDepth();
        resolveCollisions();
        for (var alpha = 1; iterations > 0; --iterations) {
            relaxRightToLeft(alpha *= .99);
            resolveCollisions();
            relaxLeftToRight(alpha);
            resolveCollisions();
        }

        function initializeNodeDepth() {
            var ky = d3.min(nodesByBreadth, function(nodes) {
                return (size[1] - (nodes.length - 1) * nodePadding) / d3.sum(nodes, value);
            });

            nodesByBreadth.forEach(function(nodes) {
                nodes.forEach(function(node, i) {
                    node.y = i;
                    node.dy = node.value * ky;
                });
            });

            links.forEach(function(link) {
                link.dy = link.value * ky;
            });
        }

        function relaxLeftToRight(alpha) {
            nodesByBreadth.forEach(function(nodes, breadth) {
                nodes.forEach(function(node) {
                    if (node.targetLinks.length) {
                        var y = d3.sum(node.targetLinks, weightedSource) / d3.sum(node.targetLinks, value);
                        node.y += (y - center(node)) * alpha;
                    }
                });
            });

            function weightedSource(link) {
                return center(link.source) * link.value;
            }
        }

        function relaxRightToLeft(alpha) {
            nodesByBreadth.slice().reverse().forEach(function(nodes) {
                nodes.forEach(function(node) {
                    if (node.sourceLinks.length) {
                        var y = d3.sum(node.sourceLinks, weightedTarget) / d3.sum(node.sourceLinks, value);
                        node.y += (y - center(node)) * alpha;
                    }
                });
            });

            function weightedTarget(link) {
                return center(link.target) * link.value;
            }
        }

        function resolveCollisions() {
            nodesByBreadth.forEach(function(nodes) {
                var node,
                    dy,
                    y0 = 0,
                    n = nodes.length,
                    i;

                // Push any overlapping nodes down.
                nodes.sort(ascendingDepth);
                for (i = 0; i < n; ++i) {
                    node = nodes[i];
                    dy = y0 - node.y;
                    if (dy > 0) node.y += dy;
                    y0 = node.y + node.dy + nodePadding;
                }

                // If the bottommost node goes outside the bounds, push it back up.
                dy = y0 - nodePadding - size[1];
                if (dy > 0) {
                    y0 = node.y -= dy;

                    // Push any overlapping nodes back up.
                    for (i = n - 2; i >= 0; --i) {
                        node = nodes[i];
                        dy = node.y + node.dy + nodePadding - y0;
                        if (dy > 0) node.y -= dy;
                        y0 = node.y;
                    }
                }
            });
        }

        function ascendingDepth(a, b) {
            return a.y - b.y;
        }
    }

    function computeLinkDepths() {
        nodes.forEach(function(node) {
            node.sourceLinks.sort(ascendingTargetDepth);
            node.targetLinks.sort(ascendingSourceDepth);
        });
        nodes.forEach(function(node) {
            var sy = 0,
                ty = 0;
            node.sourceLinks.forEach(function(link) {
                link.sy = sy;
                sy += link.dy;
            });
            node.targetLinks.forEach(function(link) {
                link.ty = ty;
                ty += link.dy;
            });
        });

        function ascendingSourceDepth(a, b) {
            return a.source.y - b.source.y;
        }

        function ascendingTargetDepth(a, b) {
            return a.target.y - b.target.y;
        }
    }

    function center(node) {
        return node.y + node.dy / 2;
    }

    function value(link) {
        return link.value;
    }

    /* Cycle Related computations */
    function markCycles() {
        // ideally, find the 'feedback arc set' and remove them.
        // This way is expensive, but should be fine for small numbers of links
        var cycleMakers = [];
        var addedLinks = new Array();
        links.forEach(function(link) {
            if (createsCycle(link.source, link.target, addedLinks)) {
                link.causesCycle = true;
                link.cycleIndex = cycleMakers.length;
                cycleMakers.push(link);
            } else {
                addedLinks.push(link);
            }
        });
    };


    function createsCycle(originalSource, nodeToCheck, graph) {
        if (graph.length == 0) {
            return false;
        }

        var nextLinks = findLinksOutward(nodeToCheck, graph);
        // leaf node check
        if (nextLinks.length == 0) {
            return false;
        }

        // cycle check
        for (var i = 0; i < nextLinks.length; i++) {
            var nextLink = nextLinks[i];

            if (nextLink.target === originalSource) {
                return true;
            }

            // Recurse
            if (createsCycle(originalSource, nextLink.target, graph)) {
                return true;
            }
        }

        // Exhausted all links
        return false;
    };

    /* Given a node, find all links for which this is a source
       in the current 'known' graph  */
    function findLinksOutward(node, graph) {
        var children = [];

        for (var i = 0; i < graph.length; i++) {
            if (node == graph[i].source) {
                children.push(graph[i]);
            }
        }

        return children;
    }


    return sankey;
};

function makeSankey(data) {
    d3.select("#the_SVG_ID").remove();
    data2 = eval(eval(data));
    var units = "Users";

    var margin = {
            top: 0,
            right: 10,
            bottom: 10,
            left: 10
        },
        width = (angular.element('#dummy2').width()) - margin.left - margin.right,
        height = 250 - margin.top - margin.bottom;

    var formatNumber = d3.format(",.0f"), // zero decimal places
        format = function(d) {
            return formatNumber(d) + " " + units;
        },
        color = d3.scale.category20();

    // append the svg canvas to the page

    var svg = d3.select("#funnelSankey").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom).attr("id", "the_SVG_ID")
        .append("g")
        .attr("transform",
            "translate(" + margin.left + "," + margin.top + ")");

    // Set the sankey diagram properties
    var sankey = d3.sankey()
        .nodeWidth(10)
        .nodePadding(100)
        .size([width, height]);

    var path = sankey.link();

    graph = {
        "nodes": [],
        "links": []
    };

    // data.forEach(function (d) {
    //   graph.nodes.push({ "name": d.source });
    //   graph.nodes.push({ "name": d.target });
    //   graph.links.push({ "source": d.source,
    //                      "target": d.target,
    //                      "value": +d.value });
    //  });
    full_count = 0;
    l = data2.length;
    if (l > 0) {
        first_name = "START";
        for (var d in data2) {
            if (data2[d].source == first_name) full_count += data2[d].value;
        }
    }
    var threshold = 0.5;
    if (['Pg'].indexOf(getCookie('role')) > -1) threshold = 0.01;
    for (var d in data2) {
        if (((data2[d].value * 100.0) / full_count) >= threshold) {
            graph.nodes.push({
                "name": data2[d].source
            });
            graph.nodes.push({
                "name": data2[d].target
            });
            graph.links.push({
                "source": data2[d].source,
                "target": data2[d].target,
                "value": +data2[d].value,
                "drs": data2[d].drs
            });
        }
    }
    // return only the distinct / unique nodes
    graph.nodes = d3.keys(d3.nest()
        .key(function(d) {
            return d.name;
        })
        .map(graph.nodes));
    // loop through each link replacing the text with its index from node
    graph.links.forEach(function(d, i) {
        graph.links[i].source = graph.nodes.indexOf(graph.links[i].source);
        graph.links[i].target = graph.nodes.indexOf(graph.links[i].target);
    });

    //now loop through each nodes to make nodes an array of objects
    // rather than an array of strings
    graph.nodes.forEach(function(d, i) {
        graph.nodes[i] = {
            "name": d
        };
    });
    sankey
        .nodes(graph.nodes)
        .links(graph.links)
        .layout(32);

    // add in the links
    var allgraphics = svg.append("g").attr("id", "node-and-link-container");

    var link = allgraphics.append("g").attr("id", "link-container")
        .selectAll(".link")
        .data(graph.links)
        .enter().append("path")
        .attr("class", function(d) {
            return (d.causesCycle ? "cycleLink" : "link")
        })
        .attr("d", path)
        .sort(function(a, b) {
            return b.dy - a.dy;
        });

    link.filter(function(d) {
            return !d.causesCycle
        })
        .style("stroke-width", function(d) {
            return Math.max(1, d.dy);
        })

    link.append("title")
        .text(function(d) {
            a = d.source.value;
            b = d.value;
            c = ((b * 100.0) / (full_count));
            b = ((b * 100.0) / (a));
            drs = "";
            sep = ""
            if (d.target.name == "FAILURE") {
                if (d.drs.length >= 1) drs = "Top Dropout Reasons:";
                sep = "\n-------------------\n";
                for (var ij = 0; ij < d.drs.length; ij++) {
                    drs += "\n" + d.drs[ij][0] + " : " + ((d.drs[ij][1] * 100.0) / (d.value)).toFixed(2) + "%";
                }
            }
            return "Vol of total: " + c.toFixed(2) + "%\nVol of last node: " + b.toFixed(2) +
                "%\n" + d.source.name + " -> " + d.target.name + "\n" + format(d.value) + sep + drs;
        });


    var node = allgraphics.append("g").attr("id", "node-container")
        .selectAll(".node")
        .data(graph.nodes)
        .enter().append("g")
        .attr("class", "node")
        .attr("transform", function(d) {
            return "translate(" + d.x + "," + d.y + ")";
        })
        .call(d3.behavior.drag()
            .origin(function(d) {
                return d;         })
            .on("dragstart", function() {
                this.parentNode.appendChild(this);
            })
            .on("drag", dragmove));

    node.append("rect")
        .attr("height", function(d) {
            return d.dy;
        })
        .attr("width", sankey.nodeWidth())
        .style("fill", function(d) {
            if (d.name == "SUCCESS") return 'green';
            else if (d.name == "FAILURE") return 'red';
            else return d.color = color(d.name.replace(/ .*/, ""));
        })
        .style("stroke", function(d) {
            return d3.rgb(d.color).darker(2);
        })
        .append("title")
        .text(function(d) {
            return d.name + "\n" + format(d.value);
        });

    node.append("text")
        .attr("x", -6)
        .attr("y", function(d) {
            return d.dy / 2;
        })
        .attr("dy", ".35em")
        .attr("text-anchor", "end")
        .attr("transform", null)
        .text(function(d) {
            return d.name;
        })
        .filter(function(d) {
            return d.x < width / 2;
        })
        .attr("x", 6 + sankey.nodeWidth())
        .attr("text-anchor", "start");

    // the function for moving the nodes
    function dragmove(d) {
        d3.select(this).attr("transform",
            "translate(" + (
                d.x = Math.max(0, Math.min(width - d.dx, d3.event.x))
            ) + "," + (
                d.y = Math.max(0, Math.min(height - d.dy, d3.event.y))
            ) + ")");
        sankey.relayout();
        link.attr("d", path);
    }
    var numCycles = 0;
    for (var i = 0; i < sankey.links().length; i++) {
        if (sankey.links()[i].causesCycle) {
            numCycles++;
        }
    }

    var cycleTopMarginSize = (sankey.cycleLaneDistFromFwdPaths() -
        ((sankey.cycleLaneNarrowWidth() + sankey.cycleSmallWidthBuffer()) * numCycles))
    var horizontalMarginSize = (sankey.cycleDistFromNode() + sankey.cycleControlPointDist());

}

function removeSankey() {
    d3.select("#the_SVG_ID").remove();
}