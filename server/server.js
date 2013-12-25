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
		'-p', '-P', '--port',
		'-t', '-T', '--theme',
		'-i', '-I', '--interval',
	],
	[ // args without value (flags)
		'-a','-A','--auth',
		'-h','--help'
	]
);

arg_parser.uniq(args, ['-p', '--port'], 3000);
arg_parser.uniq(args, ['-i', '--interval'], 3);
arg_parser.uniq(args, ['-t', '--theme'], 'default');
arg_parser.uniq(args, ['-a', '--auth'], false);
arg_parser.uniq(args, ['-h', '--help'], false);

if(args['-h']) {
	
	console.log(
		'Usage:\n'+
		'nodemon [-i INTERVAL] [-p PORT] [-t THEME] [-a] [-h]\n\n'+
		'-i INTERVAL (--interval INTERVAL)\n'+
		'\tSeconds delay between updates, can be floating point (eg. 0.5).\n'+
		'\tDefaults to 3.\n\n'+
		'-p PORT (--port PORT)\n'+
		'\tListening port. Defaults to 3000.\n\n'+
		'-t THEME (--theme THEME)\n'+
		'\tFrontend theme. Defaults to "default".\n\n'+
		'-a (--auth)\n'+
		'\tUse authentication (credentials are read from ./auth/users.htpasswd)\n\n'+
		'-h (--help)\n'+
		'\tShow this help.\n\n'+
		'Autor: Ondřej Hruška, ondra@ondrovo.com'
	);
	
	process.exit(0);
}

GLOBAL.PORT = args['-p']*1;
GLOBAL.THEME = args['-t'].toString();
GLOBAL.INTERVAL = Math.max(100, Math.round(args['-i'] * 1000));
GLOBAL.USE_AUTH = args['-a'];


console.log('Initializing...');
console.log('THEME    = '+THEME);
console.log('INTERVAL = '+INTERVAL+' ms');
console.log('USE_AUTH = '+(USE_AUTH?'YES':'NO'));
console.log('PORT     = '+PORT);


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


session_sio.on('connection', function (err, socket, session) {
	
	console.log('Socket open.');
	
	if(USE_AUTH && (session == undefined || !session.valid)) {
		socket.disconnect();
		console.log('No session found, socket closed.');
		return;
	}
	
	var sendUpdate = function() {
		monitor.collectStats(function(data) {
			socket.emit('update', data);
		});
	};
	
	sendUpdate(); // serve initial data
	
	var id = setInterval(sendUpdate, INTERVAL);
	
	socket.on('close', function() {
		console.log('Socket closed.');
		clearInterval(id);
	});
	
});


server.listen(PORT);
console.log('\nListening at port '+PORT);