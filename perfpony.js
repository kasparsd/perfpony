const lighthouse = require('lighthouse');
const chromeLauncher = require('lighthouse/chrome-launcher');
const csvParse = require('csv-parse');
const csvStringify = require('csv-stringify');
const fs = require('fs');

const chromeFlags = {
	chromeFlags: ['--headless']
};

function reportToCsv( report ) {
	var csv = [];

	// Add the header row.
	csv.push( Object.keys( report[0] ) );

	report.forEach( function( urlReport ) {
		csv.push( Object.values( urlReport ) );
	} );

	return csv;
}

function lighthouseResultToReport( results ) {
	var report = {
		'URL': results.url,
		'Timestamp': results.generatedTime,
		'First Paint': results.audits['first-meaningful-paint'].rawValue / 1000,
		'First Paint Score': results.audits['first-meaningful-paint'].score,
		'First Interactive': results.audits['first-interactive'].rawValue / 1000,
		'First Interactive Score': results.audits['first-interactive'].score,
		'Page Size (kB)': parseInt( results.audits['total-byte-weight'].rawValue / 1024 ),
		'DOM Node Count': results.audits['dom-size'].rawValue
	};

	results.reportCategories.forEach(function(reportCategory) {
		report[ reportCategory.name ] = parseInt( reportCategory.score );
	});

	return report;
}

function getReportId() {
	var d = new Date();
	var parts = [
		d.getFullYear(),
		d.getMonth() + 1,
		d.getDate(),
		'-',
		d.getHours(),
		d.getMinutes(),
		d.getSeconds()
	];

	return parts.join('');
}

function runLighthouse( urls, flags, reports = [] ) {
	var url = urls.shift();

	console.log( 'Report started: ' + url );

	return lighthouse( url, flags ).then( result => {
		console.log( 'Report completed: ' + url );

		reports.push( lighthouseResultToReport( result ) );

		if ( urls.length ) {
			return runLighthouse( urls, flags, reports );
		}

		return reports;
	} );
}

if ( 'undefined' === typeof process.argv[2] ) {
	return console.error( 'Need a CSV file of URLs to check.' );
}

// @todo Add validation, catch fail.
var urlCsv = process.argv[2] + '';

fs.readFile( urlCsv, ( err, data ) => {

	csvParse( data, (err, csv ) => {

		if ( err ) {
			throw err;
		}

		chromeLauncher.launch( chromeFlags ).then( chrome => {
			var urls = csv.map( entry => entry[0] );
			var reportFilename = [ 'reports/report-', getReportId(), '.csv' ].join('');

			runLighthouse( urls, { port: chrome.port } ).then( ( reports ) => {
				var csv = reportToCsv( reports );

				csvStringify( csv, function( error, output ) {
					fs.writeFile( reportFilename, output, ( err ) => {
						if ( err ) {
							throw err;
						}

						console.log( 'Report Completed!' );
						console.log( output );
					} );
				} );

				chrome.kill();
			} ).catch( error => {
				console.error(error);
				chrome.kill();
			} );

		} ).catch( err => console.error( err ) );

	} );

} );
