const express = require('express');
const MongoClient = require('mongodb').MongoClient;
const mongoDBurl = 'mongodb+srv://howard:howard@cluster0-ejm2n.mongodb.net/test?retryWrites=true&w=majority';
const dbName = 'test';
const assert = require('assert');
const ObjectId = require('mongodb').ObjectID;
const fs = require('fs');
var bodyParser = require('body-parser');
var session = require('cookie-session');
const { check, validationResult } = require('express-validator');
const formidable = require('formidable');
const multer = require('multer');
//const upload = multer({dest :'uploads/'})

const uploadImage = multer({
  	limits: {
    		fileSize: 10 * 1024 * 1024 //Maximum file size is 10MB
  	},
  	fileFilter: function (req, file, callback) {
        	let filetypes = /jpeg|jpg|png|gif/;
        	let mimetype = filetypes.test(file.mimetype);
        	if (mimetype) {
            		return callback(null, true);
        }
        callback(new Error('Invalid IMAGE Type'))
  }
}).single('photo');

const app = express();


var SECRETKEY1 = '1';
var SECRETKEY2 = '2';
app.use(session({
	name: 'session',
	keys: [SECRETKEY1,SECRETKEY2]
}));

app.use(bodyParser.json()); 
app.use(bodyParser.urlencoded({ extended: false }));
app.set('view engine', 'ejs');

const userValidation = [check('name' , 'name is required').not().isEmpty() , 
		check('name' , 'name can only be number or char').matches(/^[A-Za-z0-9 ]+$/i),
		check('password' , 'password is required').not().isEmpty(),
		check('password' , 'password can only be number or char').matches(/^[A-Za-z0-9 ]+$/i),
		check('confirmPassword' , 'confirmPassword is required').if(check('confirmPassword').exists()).not().isEmpty(),
		check('confirmPassword' , 'confirmPassword can only be number or char').if(check('confirmPassword').exists()).matches(/^[A-Za-z0-9 ]+$/i)];

const loginValidation = [check('name' , 'name is required').not().isEmpty() , 
		check('name' , 'name can only be number or char').matches(/^[A-Za-z0-9 ]+$/i)];

const docValidation = [check('name' , 'name can only be number or char').matches(/^[A-Za-z0-9 ]+$/i) , 
			check('name' , 'naem is required').not().isEmpty(),
			check('cuisine' , 'cuisine can only be number or char').if(check('cuisine').exists({checkFalsy:true})).isAlphanumeric(),
			check('borough' , 'borough can only be number or char').if(check('borough').exists({checkFalsy:true})).isAlphanumeric(),
			check('street' , 'street can only be number or char').if(check('street').exists({checkFalsy:true})).isAlphanumeric(),
			check('zipcode' , 'cuisine can only be number ').if(check('zipcode').exists({checkFalsy:true})).isNumeric(),
			check('lon_coord' , 'lon_coord need  in form of float').if(check('lon_coord').exists({checkFalsy:true})).isDecimal(),
			check('lat_coord' , 'lan_coord need  in form of float').if(check('lat_coord').exists({checkFalsy:true})).isDecimal()];

var rateValidation = [check('rate' , 'rate need  in form of float , min value is 0.0 and max value is 10.0').isFloat({ min: 0.0, max: 10.0}) , 
			check('rate' , 'rate is required').if(check('rate').exists({checkFalsy:true})).isFloat({ min: 0.0, max: 10.0})];

const apiValidation = [check('name' , 'name is required').not().isEmpty(),
			check('name' , 'name can only be number or char').matches(/^[A-Za-z0-9 ]+$/i) , 
			check('owner' , 'owner is required').not().isEmpty(),
			check('owner' , 'owner is char').isAlpha()];

function checkAuth(req, res, next) {
	if (!req.session.authenticated) {
		res.render("index",{error:"please login first!!"});
	} 
	else {
		next();
	}
}

const findRestaurants = (db, criteria, callback) => {
	let criteriaObj = criteria;
	//console.log(criteriaObj);
	cursor = db.collection('project_restaurant').find(criteriaObj).limit(20);
	cursor.toArray((err,docs) => {
		assert.equal(err,null);
		//console.log(docs);
		callback(docs);
	});
}

app.get('/loginForm', (req, res) => {
	if (req.session.authenticated != true) {
		res.render("loginForm",{error:""});
	}
	else {
		res.redirect('/main');
	}
});

app.post('/login', loginValidation , (req, res) => {
	const error = validationResult(req);
	if (!error.isEmpty()) {
		res.render("loginForm",{error: error.array()[0].msg});
	}
	var user ={};
	if(req.body.name.length>0){
		user['name'] = req.body.name;
	}

	user['password'] = req.body.password;
	if (Object.keys(user).length > 0) {
		const client = new MongoClient(mongoDBurl);
		client.connect((err) => {
			const db = client.db(dbName);
			cursor = db.collection('users').find({name:user.name , password:user.password});
			cursor.toArray((err,docs) => {
				if(docs.length == 0){
					res.render("loginForm",{error: "worng user name or password"});
				}
				else {
					req.session.authenticated = true;
					req.session.username = user.name;
					res.redirect('/main');
				}
			});
		});
	}
});

app.get('/registerForm', (req, res) => {
	res.render("registerForm",{error:"", success:""});
});


app.post('/register', userValidation ,(req, res) => {
	const errors = validationResult(req)
	if (!errors.isEmpty()) {
		res.render("registerForm",{error: errors.array()[0].msg,success: ""});
	}
	else {
		if(req.body.password == req.body.confirmPassword) {
			var new_user ={};
			if(req.body.name.length>0){
				new_user['name'] = req.body.name;
			}
			if(req.body.password.length>0){
				new_user['password'] = req.body.password;
			}
			if (Object.keys(new_user).length > 1) {
				//console.log(new_user);
				const client = new MongoClient(mongoDBurl);
				client.connect((err) => {
					const db = client.db(dbName);
					cursor = db.collection('users').find({name:req.body.name});
					cursor.toArray((err,docs) => {
						if(docs.length == 0){
							db.collection('users').insertOne(new_user,(err,result) => {
								assert.equal(err,null);
								res.render("registerForm",{error:"" ,success: "success!!"});
							});	
						}
						else {
							res.render("registerForm",{error: "user name already exist!!", success: ""});
						}
					});
				});
			}
			else {
				res.render("registerForm",{error: "emtpy filed",success: ""});
			}
		}
		else {
			res.render("registerForm",{error: "confirm password are not the same as your password!!",success: ""});
		}
	}

});

app.get('/main/createPage', checkAuth , (req, res) => {
	res.render("createPage",  {Username: req.session.username,error:"", success:""});
});

app.post('/main/create', (req, res , next) => {
	uploadImage(req, res , (err) =>  {
    		if (err) {
	      		res.render("createPage",{error:"file have a limited sizs of 10mb and only support png/jpg/jpeg/gif",success: ""});
    		}
		else {
			next();
		}
	});
});

app.post('/main/create',docValidation , (req, res) => {
	let docObj = {};
	let tempObj = {};
	let tempArray = [];
	const errors = validationResult(req)
	if (!errors.isEmpty()) {
		res.render("createPage",{error: errors.array()[0].msg,success: ""});
	}
	else {
		//console.log(req.body.lon_corrd);
		//console.log(req.body.lat_corrd);
		if(req.body.lon_corrd != "" && req.body.lat_corrd == ""){
			res.render("createPage",{Username: req.session.username,error: "you need to input both lon and lat corrd",success: ""});
		}
		else if(req.body.lon_corrd == "" && req.body.lat_corrd != ""){
			res.render("createPage",{Username: req.session.username,error: "you need to input both lon and lat corrd",success: ""});
		}
		else {
			if(req.hasOwnProperty('file')){
				const mimetype = req.file.mimetype;
				if(req.file.buffer != "") {
					docObj['mimetype'] = mimetype;
					docObj['photo'] = new Buffer(req.file.buffer).toString('base64');
				}
			}
			const name_value_pairs = Object.entries(req.body);
			name_value_pairs.forEach((value,index,array) => {
				if(value[0] == "street"|| value[0] == "building" || value[0] == "zipcode"){
					if(value[1].length>0){
						tempObj[value[0]] = value[1];
						docObj['address'] = tempObj;;
					}
				}
				else if(value[0] == "lon_corrd"){
					if(value[1].length>0){
						tempArray[0] = value[1];
						tempObj['corrd'] = tempArray;
						docObj['address'] = tempObj;
					}
				}
				else if (value[0] == "lat_corrd"){
					if(value[1].length>0){
						tempArray[1] = value[1];
						tempObj['corrd'] = tempArray;
						docObj['address'] = tempObj;
					}
				}	
				else {
					if(value[1].length>0){
						docObj[value[0]] = value[1];	
					}
				}
			});
			docObj['owner'] = req.session.username;
			const client = new MongoClient(mongoDBurl);
			client.connect((err) => {
				const db = client.db(dbName);
				findRestaurants(db, docObj, (restaurants) => {
					client.close();
					if(restaurants.length > 0){
						res.render("createPage",  {Username: req.session.username,error:"restaurant alread exists",success:""});
					}
					else {
						if (Object.keys(docObj).length > 1) {
							const client = new MongoClient(mongoDBurl);
							client.connect((err) => {
								const db = client.db(dbName);
								db.collection('project_restaurant').insertOne(docObj,(err,result) => {
								console.log("success");
								res.render("createPage",  {Username: req.session.username,error:"",success:"success"});
								});
							});
						}
						else {
							res.render("createPage",  {Username: req.session.username,error:"at least fill in one box",success:""});
						}
					}
				});
			});
		}
	}
});

app.get('/main/docunmentPage', checkAuth , (req, res) => {
	let docObj = {};
	const name_value_pairs = Object.entries(req.query);
		name_value_pairs.forEach((value,index,array) => {
			if(value[0] == "street"|| value[0] == "building" || value[0] == "zipcode"){
				if(value[1].length>0){
					tempObj[value[0]] = value[1];
					docObj['address'] = tempObj;;
				}
			}	
			else {
				if(value[1].length>0){
					docObj[value[0]] = value[1];	
				}
			}
		});
	console.log(docObj);
	const client = new MongoClient(mongoDBurl);
	client.connect((err) => {
		assert.equal(null,err);
		//console.log("Connected successfully to server");
		const db = client.db(dbName);
		//console.log(req.session.username);
		findRestaurants(db, docObj, (restaurants) => {
			client.close();
			//console.log(restaurants);
			res.render("docunmentPage", {restaurant : restaurants , Username: req.session.username});
		});
	});
});

app.get('/main/display', checkAuth, (req, res) => {

	const client = new MongoClient(mongoDBurl);
	client.connect((err) => {
		const db = client.db(dbName);
		findRestaurants(db, {_id: ObjectId(req.query._id)}, (restaurants) => {
			//console.log(restaurants);
			if(req.query.hasOwnProperty('error')){
				res.render("displayPage", {restaurant : restaurants[0] , Username: req.session.username, error: req.query.error, success:req.query.success});
			}
			else if(req.query.hasOwnProperty('success')){
				res.render("displayPage", {restaurant : restaurants[0] , Username: req.session.username, error: req.query.error , success:req.query.success});
			}
			else{
				res.render("displayPage", {restaurant : restaurants[0] , Username: req.session.username, error:"",success:""});
			}
		});
	});
});

app.get('/main/docunmentPage/updateForm',checkAuth, (req, res) => {
	//console.log(req.query);
	if(req.query.owner == req.session.username){
		errors = req.query.error;
		Success = req.query.success;
		//console.log(req.query.error);
		const client = new MongoClient(mongoDBurl);
		client.connect((err) => {
			assert.equal(null,err);
			//console.log("Connected successfully to server");
			const db = client.db(dbName);
			findRestaurants(db, {_id: ObjectId(req.query._id)}, (restaurants) => {
				client.close();
				//console.log(restaurants[0]);
				//console.log(restaurants[0].grades);
				res.render("updateForm", {passing:restaurants[0],Username: req.session.username,error:errors,success:Success});
			});
		});
	}
	else {
		res.redirect('/main/display?_id='+ObjectId(req.query._id)+'&error=you are not allow to update&success=');
	}
});

app.post('/main/docunmentPage/updateForm/update', (req, res , next) => {
	uploadImage(req, res , (err) =>  {
    		if (err) {
			//console.log(req);
	      		res.redirect('/main/docunmentPage/updateForm?_id='+ObjectId(req.body._id)+'&owner='+req.body.owner+'&error=file have a limited sizs of 10mb and only support png/jpg/jpeg/gif&success=');
    		}
		else {
			next();
		}
	});
});

app.post('/main/docunmentPage/updateForm/update',docValidation, (req, res) => {
	let docObj = {};
	let tempObj = {};
	let tempArray = [];
	let tempArray1 = [];
	const errors = validationResult(req)
	if (!errors.isEmpty()) {
		res.redirect('/main/docunmentPage/updateForm?_id='+ObjectId(req.body._id)+'&owner='+req.body.owner+'&error='+errors.array()[0].msg+'&success=');
	}
	else {
		if(req.body.lon_corrd != "" && req.body.lat_corrd == ""){
			res.redirect('/main/docunmentPage/updateForm?_id='+ObjectId(req.body._id)+'&owner='+req.body.owner+'&error=you need to input both lon and lat corrd&success=');
			res.render("createPage",{Username: req.session.username,error: "you need to input both lon and lat corrd",success: ""});
		}
		else if(req.body.lon_corrd == "" && req.body.lat_corrd != ""){
			res.redirect('/main/docunmentPage/updateForm?_id='+ObjectId(req.body._id)+'&owner='+req.body.owner+'&error=you need to input both lon and lat corrd&success=');
		}
		else {
			if(req.hasOwnProperty('file')){
				const mimetype = req.file.mimetype;
				if(req.file.buffer != "") {
					docObj['mimetype'] = mimetype;
					docObj['photo'] = new Buffer(req.file.buffer).toString('base64');
				}
			}
			//console.log(req.body);
			const name_value_pairs = Object.entries(req.body);
			//console.log(name_value_pairs);
			name_value_pairs.forEach((value,index,array) => {
				if(value[0] == "street"|| value[0] == "building" || value[0] == "zipcode"){
					if(value[1].length>0){
						tempObj[value[0]] = value[1];
						docObj['address'] = tempObj;;
					}
				}
				else if(value[0] == "lon_corrd"){
					if(value[1].length>0){
						tempArray[0] = value[1];
						tempObj['corrd'] = tempArray;
						docObj['address'] = tempObj;
					}
				}
				else if (value[0] == "lat_corrd"){
					if(value[1].length>0){
						tempArray[1] = value[1];
						tempObj['corrd'] = tempArray;
						docObj['address'] = tempObj;
					}
				}
				else {
					if(value[1].length>0){
						docObj[value[0]] = value[1];	
					}
				}
			});
			//console.log(docObj.user[0]);
			if(docObj.hasOwnProperty('user') && docObj.hasOwnProperty('score')){
				for(var i = 0; i< docObj.user.length; i++){
					let tempObj1 = {};
					tempObj1['user'] = docObj.user[i];
					tempObj1['score'] = docObj.score[i];
					tempArray1[i] = tempObj1;
				}
				docObj['grades'] = tempArray1;
			}
			console.log(docObj);
			const client = new MongoClient(mongoDBurl);
			client.connect((err) => {
				const db = client.db(dbName);
				if (Object.keys(docObj).length > 2) {
					const client = new MongoClient(mongoDBurl);
					client.connect((err) => {
						const db = client.db(dbName);
						let criteria = {};
						criteria['_id'] = ObjectId(docObj._id);
						delete docObj._id;
						db.collection('project_restaurant').replaceOne(criteria,docObj,(err,result) => {
							console.log(JSON.stringify(result));
							res.redirect('/main/docunmentPage/updateForm?_id='+ObjectId(req.body._id)+'&owner='+docObj.owner+'&error=&success=succes')
						});
					});
				}
				else {
					res.redirect('/main/docunmentPage/updateForm?_id='+ObjectId(docObj._id)+'&owner='+docObj.owner+'&error=at least fill in the name&success=');
				}
	
			});
		}
	}
});

app.get('/main/docunmentPage/delete' , checkAuth,(req, res) => {
	if(req.query.owner == req.session.username){
		const client = new MongoClient(mongoDBurl);
		client.connect((err) => {
			assert.equal(null,err);
			//console.log("Connected successfully to server");
			const db = client.db(dbName);
			let criteria = {};
			criteria['_id'] = ObjectId(req.query._id);
			db.collection('project_restaurant').deleteOne(criteria,(err,result) => {
				//console.log(result);
				res.redirect('/main/docunmentPage?owner='+req.session.username);
			});
		});
	}
	else {
		res.redirect('/main/display?_id='+ObjectId(req.query._id)+'&name='+req.session.username+'&error=you are not allow to delete&success=');
	}
});

app.get('/main/docunmentPage/ratePage',checkAuth, (req, res) => {
	if(req.query.owner != req.session.username) {
		res.render("ratePage" ,{Username:req.session.username  , id :req.query._id , owner:req.query.owner , error:"" ,success:""});
	}
	else{
		res.redirect('/main')
	}
});

app.post('/main/docunmentPage/rate', rateValidation, (req, res) => {
	const errors = validationResult(req)
	if (!errors.isEmpty()) {
		//console.log(errors);
		res.render("ratePage" ,{Username:req.session.username  , id :req.body._id , owner:req.body.owner , error:errors.array()[0].msg,success:""});
	}
	else {
	let docObj = {};
	const name_value_pairs = Object.entries(req.body);
	name_value_pairs.forEach((value,index,array) => {
		docObj[value[0]] = value[1];
	});
	const client = new MongoClient(mongoDBurl);
	client.connect((err) => {
		assert.equal(null,err);
		const db = client.db(dbName);
		findRestaurants(db, {_id : ObjectId(docObj._id.trim())}, (restaurants) => {
			//console.log(restaurants[0].hasOwnProperty('grades'));
			if(restaurants[0].hasOwnProperty('grades')){
				var i;
				//console.log(restaurants[0].grades.length);
				for (i = 0; i < restaurants[0].grades.length; i++) {
  					if(restaurants[0].grades[i].user == docObj.user.trim()){
						res.render("ratePage" ,{Username:req.session.username  , id :req.body._id , owner:req.body.owner , error:"you can only rate once",success:""});
						break;	
					}
					else if(i == restaurants[0].grades.length - 1  && restaurants[0].grades[i].user != docObj.user.trim()){
						let rateobject = {user : docObj.user.trim() , score: docObj.rate};
						restaurants[0].grades[restaurants[0].grades.length] = rateobject;
						//console.log(restaurants);
						db.collection('project_restaurant').replaceOne({_id: ObjectId(restaurants[0]._id) },restaurants[0],(err,result) => {
							console.log(JSON.stringify(result));
							res.render("ratePage" ,{Username:req.session.username  , id :req.body._id , owner:req.body.owner , error:"",success:"success"});
						});
						break;
					}
				}
			}
			else {
				let rateArray = [{user : docObj.user.trim() , score: docObj.rate}];
				restaurants[0].grades = rateArray;
				//console.log(restaurants);
				db.collection('project_restaurant').replaceOne({_id: ObjectId(restaurants[0]._id) },restaurants[0],(err,result) => {
					//console.log(JSON.stringify(result));
					res.render("ratePage" ,{Username:req.session.username  , id :req.body._id , owner:req.body.owner , error:"",success:"success"});
				});
			}
		});
	});
	}
});

app.get('/main/searchPage',checkAuth, (req, res) => {
	res.render("searchPage");
});

app.get('/main', checkAuth ,(req, res) => {
	res.render("main",  {Username:req.session.username});
});

app.get('/main/logOut', (req, res) => {
	req.session = null;
	res.redirect('/');
});

app.post('/api/restaurant/', (req, res , next) => {
	uploadImage(req, res , (err) =>  {
    		if (err) {
	      		res.status(500).json({status: "failed"});
    		}
		else {
			next();
		}
	});
});

app.post('/api/restaurant/',apiValidation, (req, res) => {
	let docObj = {};
	//console.log(req.body);
	const errors = validationResult(req)
	if (!errors.isEmpty()) {
		res.status(500).json({status: "failed"});
	}
	if(req.hasOwnProperty('file')){
		const mimetype = req.file.mimetype;
		if(req.file.buffer != "") {
			docObj['mimetype'] = mimetype;
			docObj['photo'] = new Buffer(req.file.buffer).toString('base64');
		}
	}
	const name_value_pairs = Object.entries(req.body);
	console.log(name_value_pairs);
	name_value_pairs.forEach((value,index,array) => {
		if(value[0] == "address"){
			if(value[1] != ""){
				try {
					docObj[value[0]] = JSON.parse(value[1]);
				} catch (err) {
				}
			}
		}
		else if(value[0] == "grades"){
			var ar =value[1].replace(/^\[|\]|$/g, "").split(', ');
			var tempArray = [];
			var object = {};
			for(var i=0;i<ar.length;i++){
				object = JSON.parse(ar[i]);
				tempArray[i] = object;
			}
			docObj['grades'] = tempArray;
		}
		else {
			if(value[1] != ""){
				docObj[value[0]] = value[1];
			}
		}
	});
	console.log(docObj);
	if (Object.keys(docObj).length > 2) {
		const client = new MongoClient(mongoDBurl);
			client.connect((err) => {
				assert.equal(null,err);
				const db = client.db(dbName);
				db.collection('project_restaurant').insertOne(docObj,(err,result) => {
					//console.log("success");
					res.status(200).json({status: "ok",_id:docObj._id});
				});
			});
		}
		else {
			res.status(200).json({status: "failed"});
		}
	
});

app.get('/api/restaurant/name/:name', (req, res) => {
	const client = new MongoClient(mongoDBurl);
	client.connect((err) => {
		assert.equal(null,err);
		console.log("Connected successfully to server");
		let docObj = {}
		//console.log(req.params.name)
		let condition = {'name': req.params.name}
		const db = client.db(dbName);
		findRestaurants(db, condition, (restaurants) => {
			if(restaurants.length != 0){
				res.status(200).json({restaurants});
			}
			else {
				res.status(200).end('{}');
			}
		});
	});
});

app.get('/api/restaurant/borough/:borough', (req, res) => {
	const client = new MongoClient(mongoDBurl);
	client.connect((err) => {
		assert.equal(null,err);
		console.log("Connected successfully to server");
		let docObj = {}
		//console.log(req.params.name)
		let condition = {'borough' : req.params.borough}
		const db = client.db(dbName);
		findRestaurants(db, condition, (restaurants) => {
			if(restaurants.length != 0){
				res.status(200).json({restaurants});
			}
			else {
				res.status(200).end('{}');
			}
		});
	});	
});

app.get('/api/restaurant/cuisine/:cuisine', (req, res) => {
	const client = new MongoClient(mongoDBurl);
	client.connect((err) => {
		assert.equal(null,err);
		console.log("Connected successfully to server");
		let docObj = {}
		//console.log(req.params.name)
		let condition = {'cuisine' : req.params.cuisine}
		const db = client.db(dbName);
		findRestaurants(db, condition, (restaurants) => {
			if(restaurants.length != 0){
				res.status(200).json({restaurants});
			}
			else {
				res.status(200).end('{}');
			}
		});
	});	
});

app.get('/api/restaurant/name/:name/borough/:borough', (req, res) => {
	const client = new MongoClient(mongoDBurl);
	client.connect((err) => {
		assert.equal(null,err);
		console.log("Connected successfully to server");
		let docObj = {}
		//console.log(req.params.name)
		let condition = {'name' : req.params.name, 'borough' : req.params.borough};
		const db = client.db(dbName);
		findRestaurants(db, condition, (restaurants) => {
			if(restaurants.length != 0){
				res.status(200).json({restaurants});
			}
			else {
				res.status(200).end('{}');
			}
		});
	});
});

app.get('/api/restaurant/name/:name/cuisine/:cuisine', (req, res) => {
	const client = new MongoClient(mongoDBurl);
	client.connect((err) => {
		assert.equal(null,err);
		console.log("Connected successfully to server");
		let docObj = {}
		//console.log(req.params.name)
		let condition = {'name' : req.params.name, 'cuisine' : req.params.cuisine};
		const db = client.db(dbName);
		findRestaurants(db, condition, (restaurants) => {
			if(restaurants.length != 0){
				res.status(200).json({restaurants});
			}
			else {
				res.status(200).end('{}');
			}
		});
	});
});

app.get('/api/restaurant/borough/:borough/cuisine/:cuisine', (req, res) => {
	const client = new MongoClient(mongoDBurl);
	client.connect((err) => {
		assert.equal(null,err);
		console.log("Connected successfully to server");
		let docObj = {}
		//console.log(req.params.name)
		let condition = {'borough' : req.params.borough, 'cuisine' : req.params.cuisine};
		const db = client.db(dbName);
		findRestaurants(db, condition, (restaurants) => {
			if(restaurants.length != 0){
				res.status(200).json({restaurants});
			}
			else {
				res.status(200).end('{}');
			}
		});
	});
});

app.get('/api/restaurant/name/:name/borough/:borough/cuisine/:cuisine', (req, res) => {
	const client = new MongoClient(mongoDBurl);
	client.connect((err) => {
		assert.equal(null,err);
		console.log("Connected successfully to server");
		let docObj = {}
		//console.log(req.params.name)
		let condition = {'name' : req.params.name, 'borough' : req.params.borough, 'cuisine' : req.params.cuisine};
		const db = client.db(dbName);
		findRestaurants(db, condition, (restaurants) => {
			if(restaurants.length != 0){
				res.status(200).json({restaurants});
			}
			else {
				res.status(200).end('{}');
			}
		});
	});
});

app.get('/*', (req, res) => {
	res.render("index",{error:{}});
});

const server = app.listen(process.env.PORT || 8099, function () {
	const port = server.address().port;
	console.log(`Server listening at port ${port}`);
});
