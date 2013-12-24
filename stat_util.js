var exec = require('child_process').exec;

var PROC_COMMAND = 'ps --no-headers -wwe -o %cols';
var MEM_COMMAND = 'vmstat -s -S B | grep memory';
var DISK_COMMAND = 'df -T --block-size=1';
var CPU_COMMAND = 'top -b -n 5 -d.05 | grep "Cpu" | tail -n1';
var CORES_COMMAND = 'cat /proc/cpuinfo';


// interesting bits from /proc/cpuinfo
var CORES_FIELDS = [
	'model name',
	'cpu MHz',
	'cache size',
	'physical id',
	'core id',
];


// table of PS fields to be monitored
var COL=0,LEN=1,HEAD=2,FMT=3;

var PS_FIELDS = [
	//   col,  len,   header,    formatter   
	[  'pid',    8,    'PID',         null ],
	[ 'ppid',    8,   'PPID',         null ],
	[ 'nice',    4,   'NICE',         null ],
	[ 'pcpu',    6,   '%CPU',   formatPerc ],
	[ 'pmem',    6,   '%MEM',   formatPerc ],
	[ 'time',   12,   'TIME',         null ],
	[ 'user',   20,   'USER',         null ],
	[  'tty',   20,    'TTY',         null ],
	[  'vsz',   12,   'VMEM',  formatMemKB ],
	[  'rsz',   12,   'RMEM',  formatMemKB ],
	[    's',    6,  'STATE',  formatState ],
	[ 'comm',   30,    'CMD',         null ],
	[  'cmd',    0,   'ARGS',         null ],
];


/* percent formatter */
function formatPerc(perc) {
	
	return perc+' %';
}


/* state formatter */
function formatState(state) {
	
	switch(state) {
		case 'D': return 'IO wait';
		case 'R': return 'running';
		case 'S': return 'sleep';
		case 'T': return 'stopped';
		case 'W': return 'paging';
		case 'X': return 'dead';
		case 'Z': return 'zombie';
		default:  return state; /* original value */
	}
}


/* memory formatter (KB based) */
function formatMemKB(kbytes) {
	
	return formatMemB(kbytes*1000); // ???
}


/* memory formatter (B based) */
function formatMemB(bytes) {
	
	if(bytes > 1073741824*1.3) return (Math.round(( bytes / 1073741824 ) * 100 ) / 100) + ' GiB';
	if(bytes > 1048576*1.3) return Math.round( bytes / 1048576 ) + ' MiB';
	if(bytes > 1024*1.3) return Math.round( bytes / 1024 ) + ' KiB';
		
	return bytes + ' B';
}


/* format with a given formatter */
function format(formatter, value) {
	if(typeof formatter == 'function') return formatter(value);
	return value;
}


/* start building the update object */
function collectStats(handler) {
	
	callProc(function(data){ handler(data); }, {/*data*/});
}



/* proc */
function callProc(handler, data) {
	
	data.proc = {
		headers: [],
		cols: [],
		processes: [],
	};
	
	
	var cols = '';
	
	PS_FIELDS.forEach(function(field, index, array) {
		data.proc.headers.push( field[HEAD] );
		data.proc.cols.push( field[COL] );
		
		// add stuff to cols string
		if(cols.length > 0) cols += ',';
		cols += field[COL];
		if(field[LEN] != 0) cols += ':' + field[LEN];
	});
	
	
	//sanitize sort
	
	var cmd = PROC_COMMAND.replace('%cols',cols);
	
	// Run it!
	exec(cmd, function(err, stdout, stderr) {
		
		var lines = stdout.split('\n');
		
		// parse all lines
		lines.forEach(function(value, index, array) {
			
			if (value.trim().length==0) return;
			
			var process = [];
			
			for(var i=0,pos=0; i<PS_FIELDS.length; i++) {
				
				var to = undefined;
				if(i != PS_FIELDS.length-1) to = pos+PS_FIELDS[i][LEN];
				
				var field = value.substring(pos, to);
				field = format( PS_FIELDS[i][FMT], field.trim() );
				process.push(field);
				
				pos = to+1;
			}
			
			data.proc.processes.push(process);
		});
		
		callMem(handler, data);
	});
}


/* mem */
function callMem(handler, data) {
	
	data.mem = {};
	
	exec(MEM_COMMAND, function(err, stdout, stderr) {
		
		var lines = stdout.split('\n');
		
		lines.forEach(function(value, index, array) {
			
			value = value.trim();
			
			if(value.length==0) return;
			
			var match = value.match(/([0-9]+)\sB\s(.*) memory/i);
			
			data.mem[match[2]] = formatMemB(match[1]);
			
		});
		
		callDisk(handler, data);
		
	});
	
}


/* disk */
function callDisk(handler, data) {
	
	data.disk = [];
	
	exec(DISK_COMMAND, function(err, stdout, stderr) {
		
		var lines = stdout.split('\n');
		
		lines.forEach(function(value, index, array) {
			
			if(index==0) return; // skip header
			
			value = value.trim(); // skip blank line
			if (value.length==0) return;
			
			var match = value.match(/([^ ]+)\s+([^ ]+)\s+([0-9]+)\s+([0-9]+)\s+([0-9]+)\s+([0-9]+%)\s+([^ ]+)/i);

			data.disk.push({
				'drive': match[1],
				'type': match[2],
				'total': formatMemB(match[3]),
				'used': formatMemB(match[4]),
				'free': formatMemB(match[5]),
				'pused': formatPerc(match[6].replace('%','').trim()),
				'mount': match[7],
			});
		});
		
		callCores(handler, data);
		
	});
	
}


/* cores */
function callCores(handler, data) {
	
	data.cores = [];
	
	exec(CORES_COMMAND, function(err, stdout, stderr) {
		
		var coreBlocks = stdout.split('\n\n');
		
		coreBlocks.forEach(function(cb) {
		
			cb = cb.trim();
			
			if(cb.length==0) return; // skip blank core block
			
			var lines = cb.split('\n');
			var core = {};
			
			lines.forEach(function(line) {
				
				line = line.trim();
				
				if (line.length==0) return; // skip blank line
				
				var match = line.match(/([^:]+):(.*)/i);
				
				var k = match[1].trim();
				var v = match[2].trim();
				if(CORES_FIELDS.indexOf(k) != -1) core[k] = v;
				
			});
			
			data.cores.push(core);
			
		});
		
		callCpu(handler, data);
	});
}


/* cpu (optional) */
function callCpu(handler, data) {
	
	exec(CPU_COMMAND, function(err, stdout, stderr) {
		
		var line = stdout.trim();

		var match = line.match(/Cpu.*:\s*([0-9.]+)%us,\s*([0-9.]+)%sy,\s*([0-9.]+)%ni,\s*([0-9.]+)%id,\s*([0-9.]+)%wa/i);

		data.cpu = {
			'user': formatPerc(match[1]),
			'system': formatPerc(match[2]),
			'nice': formatPerc(match[3]),
			'idle': formatPerc(match[4]),
			'iowait': formatPerc(match[5])
		};
		
		handler(data);
	});
}


module.exports.collectStats = collectStats;
