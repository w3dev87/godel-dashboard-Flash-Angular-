function datePicker() {
    var cb = function(start, end, label) {
        $('#reportrange span').html(start.format('MMMM D, YYYY') + ' - ' + end.format('MMMM D, YYYY'));
        //alert("Callback has fired: [" + start.format('MMMM D, YYYY') + " to " + end.format('MMMM D, YYYY') + ", label = " + label + "]");
    }

    var optionSet1 = {
        startDate: moment().subtract('days', 6),
        endDate: moment(),
        minDate: '01/01/2012',
        maxDate: '12/31/'+moment().utc().year(),
        dateLimit: { days: 60 },
        showDropdowns: true,
        showWeekNumbers: true,
        timePicker: false,
        timePickerIncrement: 1,
        timePicker12Hour: true,
        ranges: {
            'Today': [moment(), moment()],
            'Yesterday': [moment().subtract('days', 1), moment().subtract('days', 1)],
            'Last 7 Days': [moment().subtract('days', 6), moment()],
            'Last 30 Days': [moment().subtract('days', 29), moment()],
            'This Month': [moment().startOf('month'), moment()],
            'Last Month': [moment().subtract('month', 1).startOf('month'), moment().subtract('month', 1).endOf('month')]
            },
        opens: 'left',
        buttonClasses: ['btn btn-default'],
        applyClass: 'btn-small btn-primary',
        cancelClass: 'btn-small',
        format: 'MM/DD/YYYY',
        separator: ' to ',
        locale: {
        applyLabel: 'Submit',
        cancelLabel: 'Clear',
        fromLabel: 'From',
        toLabel: 'To',
        customRangeLabel: 'Custom',
        daysOfWeek: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr','Sa'],
        monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
        firstDay: 1
    }
};
    var state = getState()
    if (getCookie(getCookie('email')) == null || getCookie(getCookie('email')) == "" || state['from'] == null || state['from'] == "") {
        optionSet1['startDate'] = moment().subtract('days', 6)
    }
    else {
        optionSet1['startDate'] = moment(checkDateFormat(state['from']))
    }

    if (getCookie(getCookie('email')) == null || getCookie(getCookie('email')) == "" || state['to'] == null || state['to'] == "") {
        optionSet1['endDate'] = moment()
    }
    else {
        optionSet1['endDate'] = moment(checkDateFormat(state['to']))
    }

    var optionSet2 = {
        startDate: moment().subtract('days', 7),
        endDate: moment(),
        opens: 'left',
        ranges: {
            'Today': [moment(), moment()],
            'Yesterday': [moment().subtract('days', 1), moment().subtract('days', 1)],
            'Last 7 Days': [moment().subtract('days', 6), moment()],
            'Last 30 Days': [moment().subtract('days', 29), moment()],
            'This Month': [moment().startOf('month'), moment()],
            'Last Month': [moment().subtract('month', 1).startOf('month'), moment().subtract('month', 1).endOf('month')]
        }
    };

    function checkDateFormat(dateString) {
        if(dateString.length > 11) {
            return dateString.split("_")[0]
        }
        return dateString
    }

        $('#reportrange span').html(moment(optionSet1['startDate']).format('MMMM D, YYYY') + ' - ' + moment(optionSet1['endDate']).format('MMMM D, YYYY'));

        $('#reportrange').daterangepicker(optionSet1, cb);
        $('#reportrange').on('apply.daterangepicker', function(ev, picker) {
            var startDate = picker.startDate.format('YYYY/MM/DD');
            var endDate = picker.endDate.format('YYYY/MM/DD');
            angular.element('#reportrange').scope().dateChange(startDate,endDate);
        });
}
