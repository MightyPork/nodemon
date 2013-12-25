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
var COL=0, LEN=1, HEAD=2, FMT=3, SORT=4, DISP=5;

var PS_FIELDS = [
	//   col,  len,   header,    formatter,      sort,    display,   
	[  'pid',    8,    'PID',         null,     'int',   'number' ],
	[ 'ppid',    8,   'PPID',         null,     'int',   'number' ],
	[ 'nice',    4,   'NICE',         null,     'int',   'number' ],
	[ 'pcpu',    6,   '%CPU',         null,   'float',  'percent' ],
	[ 'pmem',    6,   '%MEM',         null,   'float',  'percent' ],
	[ 'user',   20,   'USER',         null,  'string',     'text' ],
	[  'tty',   20,    'TTY',         null,  'string',     'text' ],
	[  'vsz',   12,   'VMEM',    memFromKB,     'int',    'bytes' ],
	[  'rsz',   12,   'RMEM',    memFromKB,     'int',    'bytes' ],
	[    's',    6,  'STATE',         null,  'string',    'state' ],
	[ 'comm',   30,    'CMD',         null,  'string',     'text' ],
	[  'cmd',    0,   'ARGS',         null,  'string',     'text' ],
];


/* memory formatter (KB based) */
function memFromKB(kbytes) {
	
	return kbytes*1024;
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
		sort_modes: [],
		disp_modes: [],
		
		entries: [],
	};
	
	
	var cols = '';
	
	PS_FIELDS.forEach(function(field, index, array) {
		data.proc.headers.push( field[HEAD] );
		data.proc.cols.push( field[COL] );
		data.proc.sort_modes.push( field[SORT] );
		data.proc.disp_modes.push( field[DISP] );
		
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
			
			var process = {};//[];
			
			for(var i=0,pos=0; i<PS_FIELDS.length; i++) {
				
				var to = undefined;
				if(i != PS_FIELDS.length-1) to = pos+PS_FIELDS[i][LEN];
				
				var field = value.substring(pos, to);
				field = format( PS_FIELDS[i][FMT], field.trim() );
				process[data.proc.cols[i]] = field; //.push(field);
				
				pos = to+1;
			}
			
			data.proc.entries.push(process);
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
			
			data.mem[match[2]] = match[1]*1;
			
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
				'drive': match[1], // drive
				'type': match[2],  // filesystem
				'total': match[3], // total bytes
				'used': match[4],  // used bytes
				'free': match[5],  // free bytes
				'pused': match[6].replace('%','').trim(), // used percent
				'mount': match[7], // mount point
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
			'user':   match[1]*1, // user (percent)
			'system': match[2]*1, // system (percent)
			'nice':   match[3]*1, // nice (percent)
			'idle':   match[4]*1, // idle (percent)
			'iowait': match[5]*1  // iowait (percent)
		};
		
		handler(data);
	});
}


module.exports.collectStats = collectStats;
