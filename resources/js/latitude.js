(function ($) {

	var methods = {

		init: function (options) {
			// Create some defaults, extending them with any options that were provided
			var settings = $.extend({
				'mapID': 'map_canvas' // settings
			}, options);
			$this = $(this);
			$this.model = {
				mapID: settings.mapID,
				latitudeCoordinates: new google.maps.LatLng(51.501904, -0.115871),
				latitudeHistoryCoordinates: [],
				mapOptions: {
					center: new google.maps.LatLng(51.501904, -0.115871),
					zoom: 13,
					mapTypeId: google.maps.MapTypeId.HYBRID
				}
			};
			$this.map = new google.maps.Map(document.getElementById($this.model.mapID), $this.model.mapOptions)
			methods.bindEvents();
			methods.callServices();

		},

		bindEvents: function () {
			// bind Events 
			$this.bind('profileEvent', function () {
				console.log('profile loaded');
			});

			$this.bind('latitudeLocationEvent', function () {
				console.log('location loaded');
				var marker = new google.maps.Marker({
					position: $this.model.latitudeCoordinates,
					title: "Last known location"
				});
				marker.setMap($this.map);
				$this.map.setCenter($this.model.latitudeCoordinates);
				methods.buildLayers();
			});

			$this.bind('latitudeHistoryEvent', function () {
				console.log('history loaded = ' + $this.model.latitudeHistoryCoordinates.length);

				// latitude history path
				var heatmap, bounds,
				latitudePath = new google.maps.Polyline({
					path: $this.model.latitudeHistoryCoordinates,
					strokeColor: "#000000",
					strokeOpacity: 1.0,
					strokeWeight: 2
				});

				// latitude history heat map
				heatmap = new google.maps.visualization.HeatmapLayer({
					data: $this.model.latitudeHistoryCoordinates
				});

				// calculate the map size (including lattitude data) and set zoom level
				bounds = new google.maps.LatLngBounds();
				$.each($this.model.latitudeHistoryCoordinates, function (key, value) {
					bounds.extend(value);
				})
				bounds.getCenter();
				$this.map.fitBounds(bounds);
				$this.model.mapOptions.zoom = $this.map.getZoom();

				// add lattitude layers
				methods.addLayer(latitudePath, 'Lattitude Path', $this.model.mapOptions.zoom);
				methods.addLayer(heatmap, 'Lattitude Heatmap', $this.model.mapOptions.zoom);
			});
		},

		buildLayers: function () {
			var layers = {
				'traffic': {
					'layer': new google.maps.TrafficLayer(),
					'text': 'Traffic',
					'zoom': $this.model.mapOptions.zoom
				},
				'cycling': {
					'layer': new google.maps.BicyclingLayer(),
					'text': 'Cycling',
					'zoom': $this.model.mapOptions.zoom
				},
				'cloud': {
					'layer': new google.maps.weather.CloudLayer(),
					'text': 'Cloud',
					'zoom': 6
				},
				'weather': {
					'layer': new google.maps.weather.WeatherLayer(),
					'text': 'Weather',
					'zoom': 12
				},
				'panoramo': {
					'layer': new google.maps.panoramio.PanoramioLayer(),
					'text': 'Panoramo',
					'zoom': $this.model.mapOptions.zoom
				}
			};
			$.each(layers, function (key, value) {
				methods.addLayer(value.layer, value.text, value.zoom)
			})

		},

		addLayer: function (layer, text, zoom) {

			//if( typeof layer === 'object' ){
			var controlDiv = document.createElement('div'),
				controlUI = document.createElement('div');

			$(controlUI).addClass('gmap-control')
				.text(text);
			$(controlDiv).addClass('gmap-control-container')
				.addClass('gmnoprint')
				.append(controlUI);

			google.maps.event.addDomListener(controlUI, 'click', function () {
				if (typeof layer.getMap() == 'undefined' || layer.getMap() === null) {
					$(controlUI).addClass('gmap-control-active');
					if (zoom != -1) {
						//$this.map.setZoom(zoom);
						//$this.model.mapOptions.zoom = zoom;

						if ($this.model.mapOptions.zoom != zoom) {
							var curZoom = $this.model.mapOptions.zoom
							zoomInterval = setInterval(function () {
								if (curZoom > zoom) {
									curZoom -= 1;
								} else {
									curZoom += 1;
								}
								$this.map.setZoom(curZoom);
								$this.model.mapOptions.zoom = curZoom;
								if (curZoom === zoom) {
									clearInterval(zoomInterval);
								}
							}, 400);
						}
					}

					$this.map.setCenter($this.model.latitudeCoordinates);
					layer.setMap($this.map);
				} else {
					layer.setMap(null);
					$(controlUI).removeClass('gmap-control-active');
				}
			});

			$this.map.controls[google.maps.ControlPosition.TOP_RIGHT].push(controlDiv);
			layer.setMap(null);

		},

		callServices: function () {
			methods.configProviders();
			this.oAuthRequest = methods.configRequests();

			// This dumps all cached tokens to console, for easyer debugging.
			//jso_dump();

			// preform data request
			$.each(this.oAuthRequest, function (key, value) {
				$.oajax({
					url: value.url,
					jso_provider: value.jso_provider,
					jso_allowia: value.jso_allowia,
					jso_scopes: value.jso_scopes,
					dataType: 'json',
					success: function (data) {
						switch (key) {
							case 'googleProfile':
								// output profile data
								try {
									var heading = $("<h1/>", {
										'text': data.name
									}).appendTo($('#profile')),
										image = $("<img/>", {
											'src': data.picture,
											'alt': data.name + "'s profile picture"
										}).appendTo($('#profile')),
										link = $("<a/>", {
											'href': data.link,
											'class': 'popup',
											'text': 'Google+'
										}).appendTo($('#profile'));
									$this.trigger('profileEvent');
								} catch (err) {
									throw 'google profile error ' + err.message
								}
								break;
							case 'lattitudeLocation':
								// store latitude location data
								try {
									$this.model.latitudeCoordinates = new google.maps.LatLng(data.data.latitude, data.data.longitude);
									$this.trigger('latitudeLocationEvent');
								} catch (err) {
									throw 'latitude coordinates error ' + err.message
								}
								break;
							case 'lattitudeHistory':
								// store latitude history data
								try {
									$.each(data.data.items, function (key, value) {
										$this.model.latitudeHistoryCoordinates.push(new google.maps.LatLng(value.latitude, value.longitude));
									})
									$this.trigger('latitudeHistoryEvent');
								} catch (err) {
									throw 'latitude history error ' + err.message
								}
								break;
							default:
								throw ('function processData() key: ' + key + ' requires a handler');
						}
					},
					error: function () {
						console.log("AJAX ERROR ($.oajax) " + key);
					}
				});
			});
			//jso_wipe();
			//methods.initMap();
		},

		configRequests: function () {
			// Setup data request
			var request = {
				'googleProfile': {
					url: "https://www.googleapis.com/oauth2/v1/userinfo",
					jso_provider: "google",
					jso_allowia: true,
					jso_scopes: ["https://www.googleapis.com/auth/userinfo.profile"]
				},

				'lattitudeLocation': {
					url: "https://www.googleapis.com/latitude/v1/currentLocation?granularity=best",
					jso_provider: "google",
					jso_allowia: true,
					jso_scopes: ["https://www.googleapis.com/auth/latitude.current.best"]
				},

				'lattitudeHistory': {
					url: "https://www.googleapis.com/latitude/v1/location?granularity=best&max-results=100000",
					jso_provider: "google",
					jso_allowia: true,
					jso_scopes: ["https://www.googleapis.com/auth/latitude.all.best"]
				}
				/*,

	            'instagram' : {
	                url: "https://api.instagram.com/v1/subscriptions",
	                jso_provider: "instagram",
	                jso_allowia: false,
	                jso_scopes: false
	            }*/
			};
			return request
		},

		formatDate: function (timestamp) {
			var day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
				month = ['Jan', 'Feb', 'MArch', 'April', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'],
				date = new Date(timestamp * 1);

			return day[date.getDay()] + " " + date.getDate() + " " + month[date.getMonth()] + " " + date.getFullYear() + " " + ("0" + (parseInt(date.getHours()) + 1)).slice(-2) + ":" + ("0" + (parseInt(date.getMinutes()) + 1)).slice(-2) + ":" + ("0" + (parseInt(date.getSeconds()) + 1)).slice(-2);
		},

		configProviders: function () {
			// Add configuration for one or more providers.
			jso_configure({
				"google": {
					client_id: "592724387191-11c780839aqbk2575mrufj6kgi3i0ksl.apps.googleusercontent.com",
					redirect_uri: "http://localhost/latitude",
					authorization: "https://accounts.google.com/o/oauth2/auth"
				}/*,
				"instagram": {
					// client secret: c3618a9feef9488a8693e127573bcd29
					client_id: "8593908dfd074e38804c4942fb368721",
					redirect_uri: "http://localhost/latitude",
					authorization: "https://instagram.com/oauth/authorize/",
					scope: ["basic", "likes"],
					isDefault: true
				},
				"facebook": {
					client_id: "-----",
					redirect_uri: "http://localhost",
					authorization: "https://www.facebook.com/dialog/oauth",
					presenttoken: "qs"
				},
				"uwap": {
					client_id: "-----",
					redirect_uri: "http://localhost",
					authorization: "http://proxydemo.app.bridge.uninett.no/_/oauth/auth.php/authorization"
				},
				"linkedin": {
					client_id: "-----",
					redirect_uri: "http://localhost",
					authorization: "https://www.linkedin.com/oauth"
				},
				"ibm": {
					client_id: "-----.googleusercontent.com",
					redirect_uri: "http://localhost",
					authorization: "https://accounts.google.com/o/oauth2/auth"
				}*/
			});

			jso_ensureTokens({
				"google": ["https://www.googleapis.com/auth/userinfo.profile"]
				//"instagram"	: ["basic", "likes"],
				//"facebook"	: ["read_stream"]
			});

		}
	};

	$.fn.latitude = function (method) {
		// Method calling logic
		if (methods[method]) {
			return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
		} else if (typeof method === 'object' || !method) {
			return methods.init.apply(this, arguments);
		} else {
			$.error('Method ' + method + ' does not exist on jQuery.carousel');
		}
	};
})(jQuery);