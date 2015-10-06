/**
 * NormalizerService.js
 *
 * @description ::
 * @docs        :: http://sailsjs.org/#!documentation/controllers
 */
var counter = 0;
module.exports = {
	entidad : entidad,
	date : date,
}
function entidad(){
	Mia.find({entity:null}).exec(function(e,mias){
		if(e) throw(e);
		console.log(mias.length);
		counter = 1;
		async.mapSeries(mias,findOrCreate,function(e,res){
			if(e) throw(e);
			console.log(res.length);
		});
	});
}
function date(){
	Mia.find().limit().exec(function(e,mias){
		if(e) throw(e);
		async.map(mias,updateDate,function(e,res){
			console.log(res.length);
		});
		
	});
};
function updateDate(mia,cb){
	var date = normalizeDate(mia);
	if(date){
		Mia.update({id:mia.id},{fecha_de_ingreso:date},cb);	
	}else{
		cb();
	}	
}
function normalizeDate(mia){
	if(mia.fecha_de_ingreso){
		if(typeof(mia.fecha_de_ingreso) === 'string'){
			var date = mia.fecha_de_ingreso.split('/');
			if(date.length === 3){
				date = new Date(date[2], date[1] - 1, date[0]);
				return date;
			}else{
				return false;
			}
		}else{
			return false;
		}		
	}else{
		return false;
	}
}

var findOrCreate = function(mia,cb){
	if(mia.entidad){
		var obj = {name:mia.entidad};
		Entidad.findOrCreate(obj,obj,function(e,entidad){
			console.log('updating '+counter++);
			Mia.update({id:mia.id},{entity:entidad.id},cb);
		});
	}else{
		cb();
	}
}