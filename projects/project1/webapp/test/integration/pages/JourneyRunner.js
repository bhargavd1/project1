sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"raptestproject/project1/test/integration/pages/TravelList.gen",
	"raptestproject/project1/test/integration/pages/TravelObjectPage.gen",
	"raptestproject/project1/test/integration/pages/BookingObjectPage.gen"
], function (JourneyRunner, TravelListGenerated, TravelObjectPageGenerated, BookingObjectPageGenerated) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('raptestproject/project1') + '/test/flp.html#app-preview',
        pages: {
			onTheTravelListGenerated: TravelListGenerated,
			onTheTravelObjectPageGenerated: TravelObjectPageGenerated,
			onTheBookingObjectPageGenerated: BookingObjectPageGenerated
        },
        async: true
    });

    return runner;
});

