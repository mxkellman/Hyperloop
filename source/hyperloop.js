/*

Bugs


Small Enhancements


Medium Enhancements


Large Enhancements


Notes
GDP and Population data sourced from 
Bureau of Economic Analysis
http://www.bea.gov/iTable/iTable.cfm?ReqID=9&step=1#reqid=9&step=1&isuri=1

Latitude and Longitude data from Google Geocoding API
https://developers.google.com/maps/documentation/geocoding/

Distance and travel times from Google Distance Matrix API
https://developers.google.com/maps/documentation/distancematrix/

data.msa = [{
	FIPS: 35620,
	FullMSAName: "New York-Northern New Jersey-Long Island, NY-NJ-PA",
	GDP: 1123460,
	GDPPerCapita: 59080,
	Population: 19015911,
	MSACity: "New York-Northern New Jersey-Long Island",
	MSAState: "NY-NJ-PA",
	City: "New York",
	State: "NY",
	geoLat: number,
	geoLng: number,
}]

data.graph = {
	msa: {
		msa: number,
	}
}

data.pairs = [
  { source: "Denver, CO",
    target: "Salt Lake City, UT",
    distance: 12345,
    drive time: { hours: 8, minutes: 45 }
  }, 
  { source: "Reno, NV", target ... }
]

data.graph = {
  "Denver, CO":
    { "Salt Lake City, UT": 12345,
      "Cheyenne, WY": 123
      "Kansas City, MO": 1234 },
  "Salt Lake City, UT": 
    { "Denver, CO": 12345, … }
}      

*/

/* global d3 */
/* global google */

/* jshint devel:true */

// dv is the namespace used to avoid collisions with other code or libraries
// all static variables and object placeholders

var dv = {
	dim: {},
	data: {},
	index: {},
	svg: {},
	setup: {},
	get: {},
	create: {},
	update: {},
	calc: {},
	draw: {},
	clear: {},
	util: {},
	scale: {},
	path: {},
	format: {},
	state: { loading: 0	},
/*
	Uncomment this back out when you're online and need the google API
	geo: new google.maps.Geocoder(),
*/
};

// dv.opt stores all options that can be changed "on the fly"
// calculates variables, especailly those based on the options and vice versa 
dv.setup.variables = function() {
	dv.opt = {
		path: {
			raw: 'data/MSA.csv',
			data: 'data/MSALatLng.csv'
		},
		cities: {
			quant: 50,
			col: 'Population',
			allstates: false,
			exclude: {}
		},
		states: {
			exclude: {'AK':true,'HI':true}
		}
	};
	dv.dim.win = {
		w: window.innerWidth || document.documentElement.clientWidth || document.getElementsByTagName('body')[0].clientWidth,
		h: window.innerHeight || document.documentElement.clientHeight || document.getElementsByTagName('body')[0].clientHeight
	};
	dv.dim.win.min = dv.dim.win.w < dv.dim.win.h ? dv.dim.win.w : dv.dim.win.h;
	dv.scale.map = dv.dim.win.w * 1.34;
	dv.dim.svg = {
		w: dv.dim.win.w,
		h: dv.dim.win.w * 0.63
	};
};

dv.update.loading = function(change) {
	dv.state.loading += change;
	if (dv.state.loading === 0) { dv.setup.withData(); }
};

dv.update.locating = function(change) {
	dv.state.locating += change;
	if (dv.state.locating === 0) {
		var csv = dv.util.objToCSV(dv.data.raw);
		d3.select('body').append('div')
			.html(csv);
	}
};

// any setup that can be done before/while the data is being processed
dv.setup.withoutData = function() {
	dv.setup.variables();
	dv.get.data();
};

// setup that has to be done after the data is loaded, called from dv.update.loading
dv.setup.withData = function() {
	//dv.setup.compare();
	dv.setup.cities('cities');
	dv.setup.links();
	dv.setup.scales();
	dv.draw.svg();
	dv.draw.states();
	dv.draw.cities();
};

dv.setup.links = function() {
	dv.data.links = [];
	dv.data.highways = {};
	var i, city, fips, hwyNumber, highway, i2, interstate,
		highways = dv.data.highways,
		//msa = dv.data.msa,
		msaIndex = dv.index.msa,
		interstates = [],
		hwyCities = [],
		hwyKeys = [];
	for (i = dv.data.msa.length - 1; i >= 0; i--) {
		city = dv.data.msa[i];
		if (city.Interstate) {
			interstates = city.Interstate.split(',');
			for (i2 = interstates.length - 1; i2 >= 0; i2--) {
				interstate = interstates[i2];
				if (!highways[interstate]) {
					highways[interstate] = [];
				}
				highways[interstate].push(city.FIPS);
			}
		}
	}
	hwyKeys = d3.keys(highways);
	for (i = hwyKeys.length - 1; i >= 0; i--) {
		hwyNumber = hwyKeys[i];
		highway = highways[hwyNumber];
		hwyCities = [];
		for (i2 = highway.length - 1; i2 >= 0; i2--) {
			fips = highway[i2];
			city = msaIndex[fips];
			hwyCities.push(city);
		}
		hwyCities = dv.util.sortHighway(hwyNumber, hwyCities);
		highways[hwyNumber] = hwyCities;
	}
};

dv.util.sortHighway = function(hwyNumber, hwyCities) {
	if (hwyNumber%2 === 0) {
		hwyCities.sort(function(a, b) {
			return b.geoLng - a.geoLng;
		});
	} else {
		hwyCities.sort(function(a, b) {
			return b.geoLat - a.geoLat;
		});
	}
	return hwyCities;
};

dv.setup.compare = function() {
	var both = {},
		GDP = {},
		pop = {},
		city, i;

	dv.opt.cities.col = 'Population';
	dv.setup.cities('pop');
	dv.opt.cities.col = 'GDP';
	dv.setup.cities('GDP');

	for (i = dv.data.GDP.length - 1; i >= 0; i--) {
		city = dv.data.GDP[i];
		GDP[city.FIPS] = city;
		//console.log(city.City + ', ' + city.State);
	}
	for (i = dv.data.pop.length - 1; i >= 0; i--) {
		city = dv.data.pop[i];
		//console.log(city.City + ', ' + city.State);
		if (GDP[city.FIPS] || GDP[city.FIPS] === 0) {
			both[city.FIPS] = city;
			delete GDP[city.FIPS];
		} else {
			pop[city.FIPS] = city;
		}
	}
	dv.data.compare = {both:both, GDP:GDP, pop:pop};
};

dv.console = function(array) {
	for (var i = array.length - 1; i >= 0; i--) {
		var city = array[i];
		console.log(city.City);
	}
};

dv.setup.cities = function(name) {
	dv.data[name] = [];
	dv.index[name] = {};
	var optCity = dv.opt.cities,
		optState = dv.opt.states,
		col = optCity.col,
		quant = optCity.quant,
		cities = dv.data[name],
		states = {},
		i = 0,
		msa = dv.data.msa,
		index = dv.index[name],
		fips, state;

	msa.sort(function(a, b) {
		return b[col] - a[col];
	});
	if (optCity.allstates) {
		while (cities.length <= 47 && i < msa.length) {
			fips = msa[i].FIPS;
			state = msa[i].State;
			if (!states[state] && !optState.exclude[state] && !optCity.exclude[fips]) {
				states[state] = true;
				index[fips] = cities.push(msa[i]) - 1;
			}
			i++;
		}
	}
	i = 0;
	while (cities.length < quant) {
		fips = msa[i].FIPS;
		state = msa[i].State;
		if (!index[fips] && index[fips] !== 0 && !optState.exclude[state] && !optCity.exclude[fips]) {
			index[fips] = cities.push(msa[i]) - 1;
		}
		i++;
	}
};

dv.setup.scales = function() {
	var scale = dv.scale.map;
	dv.scale.projection = d3.geo.albersUsa()
		.scale(scale)
		.translate([scale / 2.7, scale / 4.3])
	;

	dv.scale.path = d3.geo.path()
		.projection(dv.scale.projection)
	;
};

dv.draw.svg = function() {
	dv.svg.main = d3.select('body').append('svg:svg')
		.attr('width', dv.dim.svg.w)
		.attr('height', dv.dim.svg.h)
		.append('svg:g')
	;

	dv.svg.map = dv.svg.main.append('svg:g')
		.attr('class', 'map')
		//.call(d3.behavior.zoom().on('zoom', this.zoom))
	;
};

dv.draw.states = function() {
	dv.svg.states = dv.svg.map.append('svg:g')
		.attr('id', 'states')
		.selectAll('.state')
			.data(dv.data.states)
			.enter().append('svg:path')
				.attr('name', function(d) { return d.properties.name; })
				.attr('class', 'state')
				.attr('d', dv.scale.path)
	;
};

dv.draw.cities = function() {
	dv.svg.cities = dv.svg.map.append('svg:g')
		.attr('id', 'cities')
		.selectAll('.city')
			.data(dv.data.cities)
			.enter().append('svg:circle')
				.attr('r', 5)
				.attr('cx', function(d) { return dv.scale.projection([d.geoLng,d.geoLat])[0]; })
				.attr('cy', function(d) { return dv.scale.projection([d.geoLng,d.geoLat])[1]; })
	;
	dv.svg.labels = dv.svg.map.append('svg:g')
		.attr('id', 'labels')
		.selectAll('.label')
			.data(dv.data.cities)
			.enter().append('svg:text')
				.attr('dx', function(d) { return dv.scale.projection([d.geoLng,d.geoLat])[0] + 9; })
				.attr('dy', function(d) { return dv.scale.projection([d.geoLng,d.geoLat])[1] + 5; })
				.text(function(d) { return d.City + ' (' + d.FIPS + ')'; })
	;
};

// retrieves the data from files and does a minimal amount of processing
// dv.update.loading tracks asynchronous data calls and calls dv.setup.withData after data is loaded  
dv.get.data = function() {
	dv.update.loading(2);
	d3.csv(dv.opt.path.data, function(error, data) {
		dv.data.msa = data;
		dv.index.msa = {};
		for (var i = data.length - 1; i >= 0; i--) {
			dv.index.msa[data[i].FIPS] = data[i];
		}
		dv.update.loading(-1);
	});
	d3.json('data/us-states.json', function(json) {
		dv.data.states = json.features;
		dv.update.loading(-1);
	});
};

dv.get.latlng = function() {
	d3.csv(dv.opt.path.raw, function(error, data) {
		var i = 0,
			city = {},
			address = '',
			loc = {},
			len = data.length,
			timer;

		dv.data.raw = data;
		timer = setInterval(function() {
			while (i < len && dv.data.raw[i].geoLat !== 'undefined') {
				i++;
			}
			if (i < len) {
				dv.update.locating(1);
				getLatLng(i);
				i++;
			} else {
				clearInterval(timer);
			}
		}, 1500);

		function getLatLng(i) {
			city = dv.data.msa[i];
			address = city.City + ', ' + city.State;
			dv.geo.geocode({'address': address}, function(results, status) {
				if (status === google.maps.GeocoderStatus.OK) {
					loc = results[0].geometry.location;
					dv.data.raw[i].geoLat = loc.lat();
					dv.data.raw[i].geoLng = loc.lng();
				} else { console.log("Fail: " + status); }
				dv.update.locating(-1);
			});
		}
	});
};

dv.util.objToCSV = function(obj) {
	var i = 0,
		i2 = 0,
		len = 0,
		len2 = 0,
		city = {},
		cols = d3.keys(obj[0]),
		col = '',
		csv = '';
	len = obj.length;
	for (i = 0; i < len; i++) {
		if (csv === '') {
			len2 = cols.length;
			for (i2 = 0; i2 < len2; i2++) {
				col = cols[i2];
				csv += '"' + col + '"';
				if (i2 < len2 - 1) { csv += ','; }
			}
			csv +='</br>';
		}
		city = obj[i];
		len2 = cols.length;
		for (i2 = 0; i2 < len2; i2++) {
			col = cols[i2];
			csv += '"' + city[col] + '"';
			if (i2 < len2 - 1) { csv += ','; }
		}
		csv +='</br>';
	}
	return csv;
};

dv.setup.withoutData();
