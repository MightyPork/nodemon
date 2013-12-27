// import
var http = require('http');
var express = require('express');
var url = require('url');
var path = require('path');

var socket_io = require('socket.io');
var connect = require('connect');
var SessionSockets = require('session.socket.io');

var http_auth = require('http-auth');

var file_util = require('./file_util.js');
var monitor = require('./monitor.js');
var arg_parser = require('./arg_parser.js');



// process args
var args = arg_parser.parse(
	[ // args with value
		'-p', '--port',
		'-t', '--theme',
		'-i', '--interval',
		'-j', '--idle-interval',
	],
	[ // args without value (flags)
		'-a','-A','--auth',
		'-h','--help',
		'-f', '--fahrenheit',
		'-v', '--verbose',
	]
);

arg_parser.uniq(args, ['-p', '--port'], 3000);
arg_parser.uniq(args, ['-i', '--interval'], 3);
arg_parser.uniq(args, ['-j', '--idle-interval'], 10);
arg_parser.uniq(args, ['-t', '--theme'], 'default');
arg_parser.uniq(args, ['-a', '--auth'], false);
arg_parser.uniq(args, ['-h', '--help'], false);
arg_parser.uniq(args, ['-f', '--fahrenheit'], false);
arg_parser.uniq(args, ['-v', '--verbose'], false);

if(args['-h']) {
	
	console.log(
		'Usage:\n'+
		'nodemon [-i INTERVAL] [-p PORT] [-t THEME] [-a] [-h]\n\n'+
		'-i INTERVAL (--interval INTERVAL)\n'+
		'\tSeconds delay between updates, can be floating point (eg. 0.5).\n'+
		'\tDefaults to 3, minimum is 0.5 (s)\n\n'+
		'-j IDLE_INTERVAL (--idle-interval IDLE_INTERVAL)\n'+
		'\tDelay between idle updates. Used when no clients are connected.\n'+
		'\tDefaults to 10, minimum is 5 (s)\n\n'+
		'-p PORT (--port PORT)\n'+
		'\tListening port. Defaults to 3000.\n\n'+
		'-t THEME (--theme THEME)\n'+
		'\tFrontend theme. Defaults to "default".\n\n'+
		'-a (--auth)\n'+
		'\tUse authentication (credentials are read from ./auth/users.htpasswd)\n\n'+
		'-f (--fahrenheit)\n'+
		'\tPrint temperatures in degrees Fahrenheit instead of Celsius.\n\n'+
		'-v (--verbose)\n'+
		'\tPrint extra debug information.\n\n'+
		'-h (--help)\n'+
		'\tShow this help.\n\n'+
		'Autor: Ondřej Hruška, ondra@ondrovo.com'
	);
	
	process.exit(0);
}

GLOBAL.PORT = args['-p']*1;
GLOBAL.THEME = args['-t'].toString();
GLOBAL.INTERVAL = Math.max(500, Math.round(args['-i'] * 1000));
GLOBAL.USE_AUTH = args['-a'];
GLOBAL.IDLE_INTERVAL = Math.max(5000, Math.round(args['-j'] * 1000));
GLOBAL.FAHR = args['-f'];
GLOBAL.VERBOSE = args['-v'];


console.log('Initializing nodemon...\n');
console.log('PORT ........... '+PORT);
console.log('USE_AUTH ....... '+(USE_AUTH?'YES':'NO'));
console.log('INTERVAL ....... '+INTERVAL+' ms');
console.log('IDLE_INTERVAL .. '+IDLE_INTERVAL+' ms');
console.log('THEME .......... '+THEME);
console.log('VERBOSE ........ '+(VERBOSE?'YES':'NO'));
console.log('TEMP_UNIT ...... '+(FAHR?'Fahrenheit':'Celsius'));
console.log('');

// init auth
var cookieParser = express.cookieParser('Polite dino eats greasy lettuce in the bathroom.');
var sessionStore = new connect.middleware.session.MemoryStore();

var basic_auth = http_auth.basic({
	realm: 'NODEMON web interface',
    file: path.join(__dirname, '../auth/users.htpasswd'),
});


var app = express();

app.configure(function () {
	app.use(cookieParser);
	app.use(express.session({ store: sessionStore }));
	
	app.use(function(req, res, next) {
		// remember verified user
		req.session.valid = true;
		next();
	});
	
	if(USE_AUTH) app.use(http_auth.connect(basic_auth));
	
	app.use(express.static(path.join(__dirname,'../client/assets')));
	
	var dir = file_util.resolveThemeDir(THEME);
	console.log('Theme dir: '+dir);
	app.use(express.static(dir));
});


// init the server
var server = http.createServer(app);
var sio = socket_io.listen(server);
var session_sio = new SessionSockets(sio, sessionStore, cookieParser);

sio.set('log level', 1); // disable annoying debug
sio.set('close timeout', 10);



var last_data = collectStats_idle();

function collectStats_active() {
	
	if(sio.sockets.clients().length == 0) return; // no need to poll if none are listening
	monitor.collectStats(function(data) {
		last_data = data;
		
		if(VERBOSE) console.log("\n\n--- ACTIVE POLL ---\n"+JSON.stringify(last_data,false," "));
	});
}

function collectStats_idle() {
	
	if(sio.sockets.clients().length != 0) return; // active, skip idle poll
	
	monitor.collectStats(function(data) {
		last_data = data;
		if(VERBOSE) console.log("\n\n--- IDLE POLL ---\n"+JSON.stringify(last_data,false," "));
	});
}

setInterval(collectStats_active, INTERVAL);
setInterval(collectStats_idle, IDLE_INTERVAL);




session_sio.on('connection', function (err, socket, session) {
	
	console.log('Socket open.');
	
	if(USE_AUTH && (session == undefined || !session.valid)) {
		socket.disconnect();
		console.log('No session found, socket closed.');
		return;
	}
	
	var sendUpdate = function() {
		socket.emit('update', last_data);
	};
	
	sendUpdate(); // serve initial data
	
	var id = setInterval(sendUpdate, INTERVAL);
	
	socket.on('disconnect', function() {
		console.log('Socket closed.');
		clearInterval(id);
	});
	
});

console.log('\nServer will start in a few seconds.\n');

var int_id = setInterval(function() {
	if(last_data != null) {
		server.listen(PORT);
		console.log('Listening at port '+PORT+'\n');
		clearInterval(int_id);
	}
}, 500);