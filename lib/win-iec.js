
module.exports = winiec;

function winiec(backbone, globalConfig, localConfig)
{
	//pull in backbone info, we gotta set our logger/emitter up
	var self = this;

	self.winFunction = "evolution";

	self.genomeType = localConfig.genomeType;
	if(!localConfig.genomeType)
		throw new Error("win-IEC needs a genome type specified."); 

	//this is how we talk to win-backbone
	self.backEmit = backbone.getEmitter(self);

	//grab our logger
	self.log = backbone.getLogger(self);

	//only vital stuff goes out for normal logs
	self.log.logLevel = localConfig.logLevel || self.log.normal;

	//we have logger and emitter, set up some of our functions
	
	//theese are teh current parents to choose from -- they will be part of the offspring creation process
	self.selectedParents = {};
	//all the evo objects we ceated -- parents are a subset
	self.evolutionObjects = {};

	//count it up
	self.parentCount = 0;

	//session information -- new nodes and connections yo! that's all we care about after all-- new innovative stuff
	//i rambled just then. For no reason. Still doing it. Sucks that you're reading this. trolololol
	self.sessionObject = {};

	//what events do we need?
	self.requiredEvents = function()
	{
		return [
		//need to be able to create artifacts
			"generator:createArtifacts"
			//in the future we will also need to save objects according to our save tendencies
			//for now, we'll offload that to UI decisions
		];
	}

	//what events do we respond to?
	self.eventCallbacks = function()
	{ 
		return {
			"evolution:selectParents" : self.selectParents,
			"evolution:unselectParents" : self.unselectParents,
			//we fetch a list of objects based on IDs, if they don't exist we create them
			"evolution:getOrCreateOffspring" : self.getOrCreateOffspring,
			"evolution:loadSeeds" : self.loadSeeds
		};
	}

	//no need for a callback here -- nuffin to do but load
	self.loadSeeds = function(idAndSeeds, finished)
	{
		//we have all the seeds and their ids, we just absorb them immediately
		for(var eID in idAndSeeds)
		{
			//grab the objects and save them
			self.evolutionObjects[eID] = idAndSeeds[eID];
		}

		//note, there is no default behavior with seeds -- as usual, you must still tell iec to select parents
		//there is no subsitute for parent selection
		if(finished)
			finished();

	}

	//just grab from evo objects -- throw error if issue
	self.selectParents = function(eIDList, finished)
	{
		if(typeof eIDList == "string")
			eIDList = [eIDList];

		for(var i=0; i < eIDList.length; i++)
		{	
			var eID = eIDList[i];

			//grab from evo
			var evoObject = self.evolutionObjects[eID];

			if(!evoObject){
				//wrong id 
				finished("Invalid parent selection: " + eID);
				return;
			}

			//save as a selected parent
			self.selectedParents[eID] = evoObject;
			self.parentCount++;
		}
	
		//send back the evolutionary object that is linked to this parentID
		finished(undefined, evoObject);
	}

	self.unselectParents = function(eIDList, finished)
	{
		if(typeof eIDList == "string")
			eIDList = [eIDList];

		for(var i=0; i < eIDList.length; i++)
		{	
			var eID = eIDList[i];

			//remove this parent from the selected parents -- doesn't delete from all the individuals
			if(self.selectedParents[eID])
				self.parentCount--;

			delete self.selectedParents[eID];
		}

		//callback optional really, here for backwards compat 
		if(finished)
			finished();

	}

	self.callGenerator = function(allObjects, toCreate, finished)
	{
		var parents = self.getOffspringParents();

		//we need to go fetch some stuff
		self.backEmit("generator:createArtifacts", self.genomeType, toCreate.length, parents, self.sessionObject, function(err, artifacts)
		{
			if(err)
			{
				//pass on the error if it happened
				finished(err);
				return;
			}
			
			self.log("iec generated " + toCreate.length + " individuals: ", artifacts);

			//otherwise, let's do this thang! match artifacts to offspring -- arbitrary don't worry
			var off = artifacts.offspring;

			for(var i=0; i < off.length; i++)
			{
				var eID = toCreate[i];
				//save our evolution object internally -- no more fetches required
				self.evolutionObjects[eID] = off[i];

				//store objects relateive to their requested ids for return
				allObjects[eID] = (off[i]);
			}

			//mark the offspring as the list objects
			finished(undefined, allObjects);
		});
	}

	//generator yo face!
	self.getOrCreateOffspring = function(eIDList, finished)
	{
		//don't bother doing anything if you havne't selected parents
		if(self.parentCount ==0)
			finished("Cannot generate offspring without parents");

		//we need to make a bunch, as many as requested
		var toCreate = [];

		var allObjects = {};

		//first we check to see which ids we already know
		for(var i=0; i < eIDList.length; i++)
		{
			var eID = eIDList[i];
			var evoObject = self.evolutionObjects[eID];
			if(!evoObject)
			{
				toCreate.push(eID);
			}
			else
			{
				//otherwise add to objects that will be sent back
				allObjects[eID] = evoObject;
			}
		}

		//now we have a list of objects that must be created
		if(toCreate.length)
		{
			//this will handle the finished call for us -- after it gets artifacts from the generator
			self.callGenerator(allObjects, toCreate, finished);	
		}
		else
		{
			//all ready to go -- send back our objects
			finished(undefined, allObjects)
		}

	}

	self.getOffspringParents = function()
	{
		var parents = [];

		for(var key in self.selectedParents)
			parents.push(self.selectedParents[key]);

		return parents;
	}

	return self;
}




