//We must test the ability to generate genotypes, force parents, and create valid offspring according to the schema

var assert = require('assert');
var should = require('should');
var colors = require('colors');
var Q = require('q');

var util = require('util');

var winiec = require('..');
var wMath = require('win-utils').math;
var winback = require('win-backbone');

var backbone, generator, backEmit, backLog;
var evoTestEnd;
var count = 0;

var emptyModule = 
{
	winFunction : "test",
	eventCallbacks : function(){ return {}; },
	requiredEvents : function() {
		return [
        "evolution:resetEvolution",
        "evolution:publishArtifact",
        "evolution:loadSeeds",
        "evolution:getOrCreateOffspring",
        "evolution:selectParents",
        "evolution:unselectParents"
			];
	}
};

var sampleSchema = {
    sample : "string"
};

var cIx = 0;

var sampleModule = 
{
    winFunction : "encoding",
    eventCallbacks : function(){ return {
       "encoding:sample-createFullOffspring" : function(genProps, parentProps, override, done) { 
                // backLog('called create full offspring ', override ? override.forceParents : ""); 
                var parents = parentProps.parents;
                var count = genProps.count;

                var allParents = [];
                var children = [];

                for(var c=0; c < count; c++)
                {
                    var ixs = [];
                    var pIx = wMath.next(parents.length);
                    var rOffspring = JSON.parse(JSON.stringify(parents[pIx]));                                    
                    rOffspring.sample = parents[pIx].sample.split("-")[0] + "-" + cIx + "-" + c;
                    // rOffspring.second = "This will be erased.";

                    ixs.push(pIx);
                    children.push(rOffspring);
                    allParents.push(ixs);
                }

                cIx++;
                //done, send er back
                done(undefined, children, allParents);

                return; 
             }

        }; 
    },
    requiredEvents : function() {
        return [
            "schema:addSchema"
            ];
    },
    initialize : function(done)
    {
       var emit = backbone.getEmitter(sampleModule);
       emit("schema:addSchema", "sample", sampleSchema, function(err)
       {
            if(err)
                done(err);
            else
                done();
       });
    }
};

var refSchema = 
{
    innerArray : { type: "array", "$ref": "sample"},
    justRef : {"$ref": "sample"},
    prop : "string"
}

var sampleRefModule  = 
{
    winFunction : "encoding",
    eventCallbacks : function(){ return {
       "encoding:sampleref-createFullOffspring" : function(genProps, parentProps, override, done) { 
                // backLog('called create full offspring ', override ? override.forceParents : ""); 
                var parents = parentProps.parents;
                var count = genProps.count;

                var allParents = [];
                var children = [];

                var convertString = function(str,c)
                {
                    return str.split("-")[0] + "-" + cIx + "-" + c;
                }

                for(var c=0; c < count; c++)
                {
                    var ixs = [];
                    var pIx = wMath.next(parents.length);
                    var rOffspring = JSON.parse(JSON.stringify(parents[pIx]));  


                    rOffspring.wid = convertString(rOffspring.wid, c);
                    var iArray = rOffspring.innerArray;
                    for(var a=0; a < iArray.length; a++){
                        iArray[a].wid = convertString(iArray[a].wid, c);
                        iArray[a].sample = convertString(iArray[a].sample, c);
                        //pull parent wids from the parent object we copied
                        iArray[a].parents = [parents[pIx].innerArray[a].wid];
                    }

                    //convert the wid and inside sample prop
                    rOffspring.justRef.wid = convertString(rOffspring.justRef.wid, c);
                    rOffspring.justRef.sample = convertString(rOffspring.justRef.sample, c);

                    //pull parent info for internal references -- WIN doesn't handle internal references if you use createfulloffspring
                    rOffspring.justRef.parents = [parents[pIx].justRef.wid];

                    rOffspring.prop = convertString(rOffspring.prop, c);
                    // rOffspring.second = "This will be erased.";

                    ixs.push(pIx);
                    children.push(rOffspring);
                    allParents.push(ixs);
                }

                cIx++;
                //done, send er back
                done(undefined, children, allParents);

                return; 
             }

        }; 
    },
    requiredEvents : function() {
        return [
            "schema:addSchema"
            ];
    },
    initialize : function(done)
    {
       var emit = backbone.getEmitter(sampleRefModule);
       emit("schema:addSchema", "sampleref", refSchema, function(err)
       {
            if(err)
                done(err);
            else
                done();
       });
    }
};

var publishModule = 
{
    winFunction : "publish",
    eventCallbacks : function(){ return {
       "publish:publishArtifacts" : function(genomeType, session, artifactList, privateList, finished) { 
                //don't do anything, just successfully save!
                setTimeout(function(){
                    finished();
                },0);
            }
        }
    },
    requiredEvents : function() {
        return [
            ];
    }
};

var qBackboneResponse = function()
{
    var defer = Q.defer();
    // self.log('qBBRes: Original: ', arguments);

    //first add our own function type
    var augmentArgs = arguments;
    // [].splice.call(augmentArgs, 0, 0, self.winFunction);
    //make some assumptions about the returning call
    var callback = function(err)
    {
        if(err)
        {
            defer.reject(err);
        }
        else
        {
            //remove the error object, send the info onwards
            [].shift.call(arguments);
            if(arguments.length > 1)
                defer.resolve(arguments);
            else
                defer.resolve.apply(defer, arguments);
        }
    };

    //then we add our callback to the end of our function -- which will get resolved here with whatever arguments are passed back
    [].push.call(augmentArgs, callback);

    // self.log('qBBRes: Augmented: ', augmentArgs);
    //make the call, we'll catch it inside the callback!
    backEmit.apply(backEmit, augmentArgs);

    return defer.promise;
}

describe('Testing win-iec for: ', function(){

    //we need to start up the WIN backend
    before(function(done){

    	//do this up front yo
    	backbone = new winback();


    	var sampleJSON = 
		{
			"win-iec" : winiec,
			"win-gen" : "win-gen",
			"win-schema" : "win-schema",
            "sample-encoding" : sampleModule,
            "sampleref-encoding" : sampleRefModule,
            "publish" : publishModule,
			"test" : emptyModule
		};
		var configurations = 
		{
			"global" : {
			},
			"win-iec" : {
                genomeType : "sample",
                //these options aren't relevant -- might change in the future -- these are for win-neat module
				options : {
					initialMutationCount : 0, 
					postMutationCount : 0
				}
				,logLevel : backbone.testing
			},
			"win-gen" : {
				"encodings" : [
					"sample",
                    "sampleref"
				]
				,validateParents : true
				,validateOffspring : true
				// ,logLevel : backbone.testing
			},
			"win-schema" : {
				multipleErrors : true
				,logLevel : backbone.testing
			}
		};

    	backbone.logLevel = backbone.testing;

    	backEmit = backbone.getEmitter(emptyModule);
    	backLog = backbone.getLogger({winFunction:"mocha"});
    	backLog.logLevel = backbone.testing;

    	//loading modules is synchronous
    	backbone.loadModules(sampleJSON, configurations);

    	var registeredEvents = backbone.registeredEvents();
    	var requiredEvents = backbone.moduleRequirements();
    		
    	backLog('Backbone Events registered: ', registeredEvents);
    	backLog('Required: ', requiredEvents);

    	backbone.initializeModules(function()
    	{
    		backLog("Finished Module Init");
 			done();
    	});

    });

    it('invalid parent choices fail in iec',function(done){

        var chosenParent = "wacky!";
         qBackboneResponse("evolution:selectParents", chosenParent)
            .then(function()
            {
                done(new Error("Failed to alert user to invalid parents"))
            })
            .fail(function(err)
            {
                //this is what we wanted all along
                backLog("Correct error: ", err);

                done();
            })
    });

     it('check seed logic works -- save the children' ,function(done){

        //one of the issues is if the internal references have the same wids -- as might be the case for seeds
        var sampleSeed = {wid: "sampleSeed", dbType: "sample", parents :[], sample: "fun"};
        var sampleArraySeed = {wid: "sampleArraySeed", dbType: "sample", parents :[], sample: "funarray"};
        var refSeed = {wid: "refSeed", dbType:"sampleref", parents:[], innerArray: [sampleArraySeed], justRef: sampleSeed, prop: "boogywoogy"}

        var seeds = {"0" : refSeed};

        backEmit("evolution:resetEvolution", "sampleref");

        backEmit("evolution:loadSeeds", seeds);

        var genOff = 10;

        var l2Publish, l2wid;

        var chosenParent = "0"


        //select the first object
         qBackboneResponse("evolution:selectParents", chosenParent)
            .then(function()
            {
                var list = [];
                for(var i=0; i < genOff; i++)
                    list.push("" + i);

                return qBackboneResponse("evolution:getOrCreateOffspring", list)
            })
            .then(function(offspring)
            {
                var rSelect = "" + wMath.next(genOff);

                //remove the original parent
                backEmit("evolution:unselectParents", chosenParent);

                //now add a new parent
                return qBackboneResponse("evolution:selectParents", [rSelect]);
            })
            .then(function(){

                //now we've chosen a different parent, we create more individuals
                //these individuals are removed from the original seed

                //therefore, we can test our pulish logic on them
                //we have offspring, now make offspring from one of those offspring objects
                var l2 = [];
                for(var i= genOff; i < 2*genOff; i++)
                    l2.push(""+i);

                l2Publish = "" + (genOff + wMath.next(genOff));

                return qBackboneResponse("evolution:getOrCreateOffspring", l2)
            })
            .then(function(offspring){

                //now we're ready to test publish (auto succeeds)
                // backLog("Created: ".red, offspring)
                // backLog("\n\n selecting: ".green, l2Publish);

                l2wid = offspring[l2Publish].wid;

                return qBackboneResponse("evolution:publishArtifact", l2Publish);
            })
            .then(function(publishedArtifact)
            {

                var singleObject = publishedArtifact[l2wid];
                backLog("\n\nPubbed: ".cyan, singleObject);

                var cp = seeds[chosenParent];
                //now let us test the published artifact
                singleObject.parents.join('').should.equal(cp.wid)
                singleObject.justRef.parents.join('').should.equal(cp.justRef.wid)
                singleObject.innerArray[0].parents.join('').should.equal(cp.innerArray[0].wid)

                done();
            })
            .fail(function(err)
            {
                backLog("\n\n\n\n\nError: ".red ,err.stack );
                done(new Error(err));
            })


    });


    it('validating parent choices in iec',function(done){

    	//use a single object as a seed

        var genomeSeed = {wid: "11111", dbType: "sample", parents :[], sample: "fun"};
        var genomeSeed2 = {wid: "22222", dbType: "sample", parents :[], sample: "notfun"};

        //create our seeds using their ids
    	var seeds = {"0" : genomeSeed, "1": genomeSeed2};
        var pCount = Object.keys(seeds).length;

        //grab a random parent
        var chosenParent = "" + wMath.next(pCount);

    	//how many to generate
    	var offcount = 10;

        //grab a bunch of unique ids to refer to these objects we're going to generate
        var idList = [];
        for(var p= pCount; p < pCount + offcount; p++)
            idList.push(p);

    	//win-gen should default session, but this will ensure a common session we can check for new nodes and connections
    	//after the creation step
    	// var session = {};

        //reest everything please
        backEmit("evolution:resetEvolution", "sample");

    	//now we call asking for loading of seeds -- synchronous -- happens immediately (no callback)
        backEmit("evolution:loadSeeds", seeds);

        qBackboneResponse("evolution:selectParents", chosenParent)
            .then(function()
            {
                //selected a seed parent
                //now let's generate these fools
                return qBackboneResponse("evolution:getOrCreateOffspring", idList);

            })
            .then(function(evoObjects)
            {
                // backLog('\tFinished creating neat genoems: '.cyan, util.inspect(evoObjects, false,10));
                //check our evo objects

                var iCount = 0;
                var chosen = seeds[chosenParent];
                // backLog("Chosen: ", evoObjects);
                for(var key in evoObjects)
                {
                    iCount++;
                    //go through evo objects duh
                    //should be the children of the chosen parent!
                    evoObjects[key].parents[0].should.equal(chosen.wid);
                }

                iCount.should.equal(idList.length);


                done();
    		})
    		.fail(function(err)
    		{
    			backLog("Failure: ", util.inspect(err, false,10));

    			if(err.errno)
    				done(err);
    			else
    				done(new Error(err.message));
    		});
    
    });
});







