var updateId = 1;

$(document).ready(function(){
	
	NODEMON.connect();
	NODEMON.on('update', function(data) {
		if(updateId==1) $('#loading').hide();
		
		updateProcTable(data.proc);
		
		if(updateId==1) $('#proc').show();
			
		updateId++;
	});
});


var sortDir = 'desc';
var sortCol = null;
function sortTable(e) {
	var th = $(e.currentTarget);
	var nr = th.index();
	
	if(sortCol != nr) {
		sortDir = 'desc';
	} else {
		sortDir = sortDir=='asc' ? 'desc' : 'asc';
	}
	
	th.siblings().addBack().removeClass('sort-asc sort-desc');
	th.addClass('sort-' + sortDir);
	sortCol = nr;
	resort();
}

function resort() {
	if(sortCol!=null) $('#proc>tbody>tr').tsort('td:eq('+sortCol+')',{order:sortDir,data:'sort-value'});
}



function buildTableHeader(proc) {
	var hrow = $('table#proc thead > tr');
	var th;
	
	proc.order.forEach(function(col, index, array) {
		
		th = $('<th>');
		
		th.text(proc.layout[col].header);
		th.append('<span class="sort-arrow-asc">↓</span><span class="sort-arrow-desc">↑</span>');
		
		hrow.append(th);
	});
	
	sortCol = $.inArray('rsz',proc.order);
	$('#proc thead th:eq('+sortCol+')').addClass('sort-'+sortDir);
	$('#proc thead th').on('click', sortTable);
}


var procRows = {};
var headerBuilt = false;
function updateProcTable(proc) {
	var table = $('#proc');
	var tbody = table.find('tbody');
	var hrow = table.find('thead > tr');

	if(!headerBuilt) {
		buildTableHeader(proc);
		headerBuilt = true;
	}
	
	var row, td, text, val, col, sm;
		
	for(var j = 0; j < proc.entries.length; j++) {
		var entry = proc.entries[j];
		
		row = procRows[entry.pid];
		
		if(row == undefined) {
			
			row = $('<tr>');
			
			proc.order.forEach(function(col, index, array) {
				td = $('<td>').attr({class: col});
				
				sm = proc.layout[col].sort_mode;
				if(sm == 'string') {
					td.css('text-align','left');
				} else {
					td.css('text-align','right');
				}
			
				row.append(td);
			});
			
			tbody.append(row);
			
			procRows[entry.pid] = row;
		}
		
		for(var i = 0; i < proc.order.length; i++) {
			
			col = proc.order[i];
			
			td = row.find('td.'+col);
			if(td.length==0) continue;
			
			val = entry[col];
			
			// value for sorting
			td.data('sort-value', val);
			
			// displayed text
			text = '';
			switch(proc.layout[col].disp_mode) {
				case 'percent': text = NODEMON.formatPerc(val); break;
				case 'bytes':   text = NODEMON.formatBytes(val); break;
				case 'state':   text = NODEMON.formatProcState(val); break;
			   
				case 'number':
				case 'text':
				default:        text = val; break;
			}
			if(td.text() != text) {
				td.text(text);
				if(col=='comm' || col=='args') td.attr('title',text);
			}
		};
		
		row.data('upd',updateId);
	};
	
	// remove processes that died since last update
	for(var pid in procRows) {
		row = procRows[pid];
		if(row.data('upd') != updateId) {
			row.remove();
			delete procRows[pid];
		}
	}
	
	if(sortCol != null) resort();
}
