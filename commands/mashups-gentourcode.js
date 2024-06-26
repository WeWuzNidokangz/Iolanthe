/*
	Commands for tour code generation
*/

// FIXME: HERE: Auto unban abilities like Drizzle from lower-tier AAA mashups

var Mashups = exports.Mashups = require('./../features/mashups/index.js');

var c_sIgnoreRuleArray = ['Pokemon', 'Standard', 'Team Preview'];

var extractedRuleArray = [];
var nExtractedRuleCount = 0;
var extractedBanArray = [];
var nExtractedBanCount = 0;
var extractedUnbanArray = [];
var nExtractedUnbanCount = 0;
var extractedRestrictionArray = [];
var nExtractedRestrictionCount = 0;
var formatStackedAddOnsDictionary = new Object();

var baseFormatDetails = null;
var baseFormatTierDetails = null;
var sBaseModName;
var nBaseGen;
var nBaseGameType;

var nTierId;
var bTierModified;
var bTierIncreased;
var bIsLC;

var IsRuleIncluded = function(sRule, params)
{
	if (extractedRuleArray && extractedRuleArray.includes(sRule)) return true;
	if (params.additionalRules && params.additionalRules.includes(sRule)) return true;
	return false;
}

var TryAddRule = function(sCurrentRule, params, sourceFormat, bTierCheck)
{
	var bIgnoreRule = false;

	if(Mashups.MASHUPS_DEBUG_ON) monitor(`DEBUG ruleset: ${sCurrentRule}`);

	var sCurrentRuleId = toId(sCurrentRule);

	// Tier rules have no value on a separate base and disrupt mashups with invisible compound bans
	for (nExistingRuleItr = 0; nExistingRuleItr < Mashups.Tier.Count; ++nExistingRuleItr) {
		if (toId(Mashups.getGenName(nBaseGen) + Mashups.tierDataArray[nExistingRuleItr].name) === sCurrentRuleId) {
			bIgnoreRule = true;

			// Format stacking needs to remove internal tier format specifications in some cases
			if(!bTierCheck) { // We can't be stacked during tier check
				if(sourceFormat.name in formatStackedAddOnsDictionary) { // Stacked format
					if(nTierId < nExistingRuleItr) { // Mashup's tier is above (<) this; it will be disruptive
						if(Mashups.MASHUPS_DEBUG_ON) monitor(`Inverting ruleset: ${sCurrentRule} (nTierId: ${nTierId}, nExistingRuleItr: ${nExistingRuleItr})`);
						bIgnoreRule = false; // Invert rule instead of ignoring it
						sCurrentRule = '!' + sCurrentRule;
						sCurrentRuleId = '!' + sCurrentRuleId;
					}
				}
			}
			break;
		}
		if (bIgnoreRule) return;
	}

	// Banned (redundant) rules
	for (nExistingRuleItr = 0; nExistingRuleItr < c_sIgnoreRuleArray.length; ++nExistingRuleItr) {
		if (toId(c_sIgnoreRuleArray[nExistingRuleItr]) === sCurrentRuleId) {
			bIgnoreRule = true;
			break;
		}
		if (bIgnoreRule) return;
	}

	// Ignore certain 'disruptive' rules like Standard with nested bans and that are generally redundant
	for (nExistingRuleItr = 0; nExistingRuleItr < Mashups.DisruptiveRuleArray.length; ++nExistingRuleItr) {
		if(Mashups.MASHUPS_DEBUG_ON) monitor(`DEBUG disruptive: ${Mashups.DisruptiveRuleArray[nExistingRuleItr]}, ${sCurrentRule}`);
		if (toId(Mashups.DisruptiveRuleArray[nExistingRuleItr]) === sCurrentRuleId) {
			bIgnoreRule = true;
			break;
		}
		if (bIgnoreRule) return;
	}

	// Ignore rules that are already in the base format
	if(baseFormatDetails.ruleset) {
		for (nExistingRuleItr = 0; nExistingRuleItr < baseFormatDetails.ruleset.length; ++nExistingRuleItr) {
			if (baseFormatDetails.ruleset[nExistingRuleItr] === sCurrentRule) {
				bIgnoreRule = true;
				break;
			}
			if (bIgnoreRule) return;
		}
	}

	if (params.additionalRules) { // Ignore rules that are redundant because they have already been added in params
		for (nExistingRuleItr = 0; nExistingRuleItr < params.additionalRules.length; ++nExistingRuleItr) {
			if (params.additionalRules[nExistingRuleItr] === sCurrentRule) {
				bIgnoreRule = true;
				break;
			}
		}
		if (bIgnoreRule) return;
	}

	if (extractedRuleArray) { // Ignore rules that are already in extractedRuleArray
		for (nExistingRuleItr = 0; nExistingRuleItr < extractedRuleArray.length; ++nExistingRuleItr) {
			if (extractedRuleArray[nExistingRuleItr] === sCurrentRule) {
				bIgnoreRule = true;
				break;
			}
		}
		if (bIgnoreRule) return;
	}

	if(Mashups.MASHUPS_DEBUG_ON) monitor(`DEBUG ruleset survived culling: ${sCurrentRule}`);

	// Add relevant rule
	extractedRuleArray[nExtractedRuleCount] = sCurrentRule;
	nExtractedRuleCount++;
}

var TryAddBan = function(sCurrentRule, params, nSourceTier, bTierCheck=false)
{
	var bIgnoreRule = false;

	if(Mashups.MASHUPS_DEBUG_ON) monitor(`DEBUG banlist: ${sCurrentRule}`);
	if(Mashups.MASHUPS_DEBUG_ON) monitor(`base: ${baseFormatDetails.name}`);

	// Ignore bans that are already in the base format
	if(baseFormatDetails.banlist) {
		for (nExistingRuleItr = 0; nExistingRuleItr < baseFormatDetails.banlist.length; ++nExistingRuleItr) {
			if (baseFormatDetails.banlist[nExistingRuleItr] === sCurrentRule) {
				bIgnoreRule = true;
				break;
			}
			if (bIgnoreRule) return;
		}
	}

	// Ignore bans that are already in the base format's tier format (e.g. Baton Pass for OU-based metas)
	if(baseFormatTierDetails.banlist) {
		for (nExistingRuleItr = 0; nExistingRuleItr < baseFormatTierDetails.banlist.length; ++nExistingRuleItr) {
			if (baseFormatTierDetails.banlist[nExistingRuleItr] === sCurrentRule) {
				bIgnoreRule = true;
				break;
			}
			if (bIgnoreRule) return;
		}
	}

	if(Mashups.MASHUPS_DEBUG_ON) monitor(`DEBUG ban survived culling 0: ${sCurrentRule}`);

	if (params.additionalBans) { // Ignore bans that are redundant because they have already been added in params
		for (nExistingRuleItr = 0; nExistingRuleItr < params.additionalBans.length; ++nExistingRuleItr) {
			if (params.additionalBans[nExistingRuleItr] === sCurrentRule) {
				bIgnoreRule = true;
				break;
			}
		}
		if (bIgnoreRule) return;
	}

	if(Mashups.MASHUPS_DEBUG_ON) monitor(`DEBUG ban survived culling 1: ${sCurrentRule}`);

	if (params.additionalUnbans) { // Ignore unbans that are in unbans params because we want that to take priority
		for (nExistingRuleItr = 0; nExistingRuleItr < params.additionalUnbans.length; ++nExistingRuleItr) {
			if (params.additionalUnbans[nExistingRuleItr] === sCurrentRule) {
				bIgnoreRule = true;
				break;
			}
		}
		if (bIgnoreRule) return;
	}

	if (extractedBanArray) { // Ignore bans that are already in extractedBanArray
		for (nExistingRuleItr = 0; nExistingRuleItr < extractedBanArray.length; ++nExistingRuleItr) {
			if (extractedBanArray[nExistingRuleItr] === sCurrentRule) {
				bIgnoreRule = true;
				break;
			}
		}
		if (bIgnoreRule) return;
	}

	var goAsPoke = Mashups.getGameObjectAsPokemon(sCurrentRule);
	if(goAsPoke) { // As Pokemon checks
		// Ignore specific Pokemon bans if it would already be banned by tier
		if(!bTierCheck && bTierModified && !bIsLC) {
			var nPokeTier = Mashups.calcPokemonTier(goAsPoke);
			if(Mashups.isABannedInTierB(nPokeTier, nTierId)) {
				return;
			}
		}
		// Ignore Pokemon bans if the final tier is higher than the source formats's tier
		if(!bTierCheck && (nTierId < nSourceTier) ) {
			var nPokeTier = Mashups.calcPokemonTier(goAsPoke);
			if(!Mashups.isABannedInTierB(nPokeTier, nTierId)) {
				return;
			}
		}
	}

	if(Mashups.MASHUPS_DEBUG_ON) monitor(`DEBUG ban survived culling: ${sCurrentRule}`);

	// Add relevant ban
	extractedBanArray[nExtractedBanCount] = sCurrentRule;
	nExtractedBanCount++;

	if (extractedUnbanArray) { // If a Pokemon is banned in one component meta and banned in another, prioritise ban: remove it from prior extracted unbans
		for (nExistingRuleItr = 0; nExistingRuleItr < nExtractedUnbanCount; ++nExistingRuleItr) {
			if (extractedUnbanArray[nExistingRuleItr] === sCurrentRule) {
				extractedUnbanArray.splice(nExistingRuleItr, 1);
				nExtractedUnbanCount--;
			}
		}
	}
}

var TryAddRestriction = function(sCurrentRule, params)
{
	var bIgnoreRule = false;

	// Ignore restrictions that are already in the base format
	if(baseFormatDetails.restricted) {
		for (nExistingRuleItr = 0; nExistingRuleItr < baseFormatDetails.restricted.length; ++nExistingRuleItr) {
			if (baseFormatDetails.restricted[nExistingRuleItr] === sCurrentRule) {
				bIgnoreRule = true;
				break;
			}
			if (bIgnoreRule) return;
		}
	}

	if (params.additionalRestrictions) { // Ignore restrictions that are redundant because they have already been added in params
		for (nExistingRuleItr = 0; nExistingRuleItr < params.additionalRestrictions.length; ++nExistingRuleItr) {
			if (params.additionalRestrictions[nExistingRuleItr] === sCurrentRule) {
				bIgnoreRule = true;
				break;
			}
		}
		if (bIgnoreRule) return;
	}

	if (extractedRestrictionArray) { // Ignore restrictions that are already in extractedRestrictionArray
		for (nExistingRuleItr = 0; nExistingRuleItr < extractedRestrictionArray.length; ++nExistingRuleItr) {
			if (extractedRestrictionArray[nExistingRuleItr] === sCurrentRule) {
				bIgnoreRule = true;
				break;
			}
		}
		if (bIgnoreRule) return;
	}

	if(Mashups.MASHUPS_DEBUG_ON) monitor(`DEBUG restriction survived culling: ${sCurrentRule}`);

	// Add relevant restrictiom
	extractedRestrictionArray[nExtractedRestrictionCount] = sCurrentRule;
	nExtractedRestrictionCount++;
}

var TryAddUnban = function(sCurrentRule, params, nSourceTier, bTierCheck=false)
{
	var bIgnoreRule = false;

	if(Mashups.MASHUPS_DEBUG_ON) monitor(`DEBUG unbanlist: ${sCurrentRule}`);

	// Ignore unbans that are already in the base format
	if(baseFormatDetails.unbanlist) {
		for (nExistingRuleItr = 0; nExistingRuleItr < baseFormatDetails.unbanlist.length; ++nExistingRuleItr) {
			if (baseFormatDetails.unbanlist[nExistingRuleItr] === sCurrentRule) {
				bIgnoreRule = true;
				break;
			}
		}
		if (bIgnoreRule) return;
	}

	if (params.additionalUnbans) { // Ignore unbans that are redundant because they have already been added in params
		for (nExistingRuleItr = 0; nExistingRuleItr < params.additionalUnbans.length; ++nExistingRuleItr) {
			if (params.additionalUnbans[nExistingRuleItr] === sCurrentRule) {
				bIgnoreRule = true;
				break;
			}
		}
		if (bIgnoreRule) return;
	}

	if (extractedUnbanArray) { // Ignore unbans that are already in extractedUnbanArray
		for (nExistingRuleItr = 0; nExistingRuleItr < extractedUnbanArray.length; ++nExistingRuleItr) {
			if (extractedUnbanArray[nExistingRuleItr] === sCurrentRule) {
				bIgnoreRule = true;
				break;
			}
		}
		if (bIgnoreRule) return;
	}

	if (params.additionalBans) { // Ignore unbans that are in ban params under all circumstances because we clearly want to definitely ban that thing
		for (nExistingRuleItr = 0; nExistingRuleItr < params.additionalBans.length; ++nExistingRuleItr) {
			if (params.additionalBans[nExistingRuleItr] === sCurrentRule) {
				bIgnoreRule = true;
				break;
			}
		}
		if (bIgnoreRule) return;
	}

	if (extractedBanArray) { // Ignore unbans that were implicitely banned by another meta (if they were in unban params also we would already have continued)
		for (nExistingRuleItr = 0; nExistingRuleItr < extractedBanArray.length; ++nExistingRuleItr) {
			if (extractedBanArray[nExistingRuleItr] === sCurrentRule) {
				bIgnoreRule = true;
				break;
			}
		}
		if (bIgnoreRule) return;
	}

	var goAsPoke = Mashups.getGameObjectAsPokemon(sCurrentRule);
	if(goAsPoke) { // As Pokemon checks
		// Autoreject overtiered pokes if base tier altered
		if(!bTierCheck && bTierModified && !bIsLC) { // FIXME: LC needs separate processing
			var nPokeTier = Mashups.calcPokemonTier(goAsPoke);
			if(Mashups.isABannedInTierB(nPokeTier, nTierId)) {
				return;
			}
		}
	}

	if(Mashups.MASHUPS_DEBUG_ON) monitor(`DEBUG unban survived culling: ${sCurrentRule}`);

	// Add relevant unban
	extractedUnbanArray[nExtractedUnbanCount] = sCurrentRule;
	nExtractedUnbanCount++;
}

var ExtractFormatRules = function(formatDetails, params, bTierCheck=false)
{
	if(!formatDetails) return;
	if(!formatDetails.name) return;

	var sCurrentRule;

	var nFormatGen = Mashups.determineFormatGen(formatDetails);
	var nFormatBasisTier = Mashups.determineFormatBasisTierId(formatDetails, nFormatGen);

	// ruleset
	if (formatDetails.ruleset) {
		//monitor(`DEBUG ruleset`);
		for (nRuleItr = 0; nRuleItr < formatDetails.ruleset.length; ++nRuleItr) {
			sCurrentRule = formatDetails.ruleset[nRuleItr];

			TryAddRule(sCurrentRule, params, formatDetails, bTierCheck);
		}
	}

	// banlist
	if (formatDetails.banlist) {
		if(Mashups.MASHUPS_DEBUG_ON) monitor(`DEBUG banlist`);
		for (nRuleItr = 0; nRuleItr < formatDetails.banlist.length; ++nRuleItr) {
			sCurrentRule = formatDetails.banlist[nRuleItr];

			TryAddBan(sCurrentRule, params, nFormatBasisTier, bTierCheck);
		}
	}

	// unbanlist
	if (formatDetails.unbanlist) {
		if(Mashups.MASHUPS_DEBUG_ON) monitor(`DEBUG unbanlist`);
		for (nRuleItr = 0; nRuleItr < formatDetails.unbanlist.length; ++nRuleItr) {
			sCurrentRule = formatDetails.unbanlist[nRuleItr];

			TryAddUnban(sCurrentRule, params, nFormatBasisTier, bTierCheck);
		}
	}

	// 20/08/02 restrictions should work now
	if (formatDetails.restricted) {
		if(Mashups.MASHUPS_DEBUG_ON) monitor(`DEBUG restricted`);
		for (nRuleItr = 0; nRuleItr < formatDetails.restricted.length; ++nRuleItr) {
			sCurrentRule = formatDetails.restricted[nRuleItr];

			TryAddRestriction(sCurrentRule, params);
		}
	}

	// Special cases
	var sGenericMetaName = Mashups.genericiseMetaName(formatDetails.name);
	if(Mashups.MASHUPS_DEBUG_ON) monitor(`DEBUG sGenericMetaName: ${sGenericMetaName}`);
	switch(sGenericMetaName) {
		// 20/08/02: New restrictions system
		/*case 'stabmons':
			ExtractStabmonsRestricted(formatDetails.restrictedMoves, params, bTierCheck, nFormatBasisTier);
			ExtractStabmonsRestricted(formatDetails.restricted, params, bTierCheck, nFormatBasisTier);
			break;*/
	}
}

var ExtractStabmonsRestricted = function(restrictedArray, params, bTierCheck, nFormatBasisTier)
{
	if (!restrictedArray) return;

	if(params.useRestrictions) { // Create restrictions
		for (nRuleItr = 0; nRuleItr < restrictedArray.length; ++nRuleItr) {
			sCurrentRule = restrictedArray[nRuleItr];
			TryAddRestriction(sCurrentRule, params);
		}
	}
	else { // In a 'short' tour code, treat restricted moves as extra bans
		for (nRuleItr = 0; nRuleItr < restrictedArray.length; ++nRuleItr) {
			sCurrentRule = restrictedArray[nRuleItr];
			TryAddBan(sCurrentRule, params, nFormatBasisTier, bTierCheck);
		}
	}
}

//#region eCommandParam

var eCommandParam = {
	'BaseFormat':0,
	'AddOnFormats':1,
	'LaunchTour':2,
	'useRestrictions':3,
	'AdditionalBans':4,
	'AdditionalUnbans':5,
	'AdditionalRules':6,
	'AdditionalUnrules':7,
	'AdditionalRestrictions':8,
	'CustomTitle':9,
	'TimeToStart':10,
	'AutoDQ':11,

    'Count':12,
};
Object.freeze(eCommandParam);

//#endregion

exports.commands = {
	genmashup: 'gentourcode',
	generatemashup: 'gentourcode',
	generatetourcode: 'gentourcode',
	gentourcode: 'gentourcode',
	gentour: 'gentourcode',
	generatetour: 'gentourcode',
	gentourcode: function (arg, user, room, cmd) {
		if (!this.isRanked(Tools.getGroup('voice'))) return false;

		if (!arg || !arg.length) {
			this.reply(`No formats specified!`);
			return;
		}

		var args = arg.split(',');
		var params = {
			baseFormat: null,
			addOnFormats: null,
			additionalBans: null,
			additionalUnbans: null,
			additionalRestrictions: null,
			additionalRules: null,
			additionalUnrules: null,
			customTitle: null,
			timeToStart: null,
			autodq: null,
			type: 'Elimination',
			useCompression: false,
			useRestrictions: true,
		};
		for (var i = 0; i < args.length; i++) {
			args[i] = args[i].trim();
			if (!args[i]) continue;
			switch (i) {
				case eCommandParam.BaseFormat: // baseFormat
					// Search base format as a server native format
					params.baseFormat = Mashups.getFormatKey(args[i]);
					// FIXME: Add support for common compound bases like PH
					if (null === params.baseFormat) {
						this.reply(`Base format: "${args[i]}" not found on this server!`);
						return;
					}
					// (Tier definition formats as bases now supported)
					break;
				case eCommandParam.AddOnFormats: { // addOnFormats
					// Start add-ons with empty array
					var nAddOnCount = 0;
					params.addOnFormats = [];

					// Split add-ons
					var sAddOnFormatsString = args[i];
					var addOnFormatsArray = sAddOnFormatsString.split('|');
					var sAddOnKey;
					if(Mashups.MASHUPS_DEBUG_ON) monitor(`DEBUG sAddOnFormatsString: ${sAddOnFormatsString}`);
					for (var nAddOn = 0; nAddOn < addOnFormatsArray.length; ++nAddOn) {
						if (!addOnFormatsArray[nAddOn]) continue;
						if(Mashups.MASHUPS_DEBUG_ON) monitor(`DEBUG addOnFormatsArray[${nAddOn}]: ${addOnFormatsArray[nAddOn]}`);
						addOnFormatsArray[nAddOn].trim();
						// Search add-on format as a server native format or rule
						sAddOnKey = Mashups.getFormatOrRulesetKey(addOnFormatsArray[nAddOn]);
						// FIXME: Add support for common compound bases like PH
						if (null === sAddOnKey) {
							this.reply(`Add-on format: "${addOnFormatsArray[nAddOn]}" not found on this server!`);
							return;
						}
						params.addOnFormats[nAddOnCount] = sAddOnKey;
						nAddOnCount++;
					}
				}
				break;
				case eCommandParam.LaunchTour: {

				}
				break;
				case eCommandParam.useRestrictions: {
					var sUseComplexBansString = args[i];
					params.useRestrictions = 'true' === toId(sUseComplexBansString) ? true : false;
				}
				break;
				case eCommandParam.AdditionalBans: { // additionalBans
					// Start addition bans with empty array
					var nAdditionalBanCount = 0;
					params.additionalBans = [];

					// Split addition bans
					var sAdditionalBansString = args[i];
					var additionalBansArray = sAdditionalBansString.split('|');
					var sBanGOKey;
					for (var nGO = 0; nGO < additionalBansArray.length; ++nGO) {
						sBanGOKey = additionalBansArray[nGO].trim(); // Do validation in warnings for reliability
						params.additionalBans[nAdditionalBanCount] = sBanGOKey;
						nAdditionalBanCount++;
					}
				}
				break;
				case eCommandParam.AdditionalUnbans: { // additionalUnbans
					// Start addition unbans with empty array
					var nAdditionalUnbanCount = 0;
					params.additionalUnbans = [];

					// Split addition unbans
					var sAdditionalUnbansString = args[i];
					var additionalUnbansArray = sAdditionalUnbansString.split('|');
					var sUnbanGOKey;
					for (var nGO = 0; nGO < additionalUnbansArray.length; ++nGO) {
						sUnbanGOKey = additionalUnbansArray[nGO].trim(); // Do validation in warnings for reliability
						params.additionalUnbans[nAdditionalUnbanCount] = sUnbanGOKey;
						nAdditionalUnbanCount++;
					}
				}
				break;
				case eCommandParam.AdditionalRules: { // additionalRules
					var nAdditionalRuleCount = 0;
					params.additionalRules = [];

					// Split addition restrictions
					var sAdditionalRulesString = args[i];
					var additionalRulesArray = sAdditionalRulesString.split('|');
					var sRuleKey;
					for (var nRule = 0; nRule < additionalRulesArray.length; ++nRule) {
						sRuleKey = additionalRulesArray[nRule].trim();
						// FIXME: Somehow pull and validate rules?
						params.additionalRules[nAdditionalRuleCount] = sRuleKey;
						nAdditionalRuleCount++;
					}
				}
				break;
				case eCommandParam.AdditionalUnrules: {

				}
				break;
				case eCommandParam.AdditionalRestrictions: { // additionalRestrictions
					// Start addition restrictions with empty array
					var nAdditionalRestrictionCount = 0;
					params.additionalRestrictions = [];

					// Split addition restrictions
					var sAdditionalRestrictionsString = args[i];
					var additionalRestrictionsArray = sAdditionalRestrictionsString.split('|');
					var sRestrictionGOKey;
					for (var nGO = 0; nGO < additionalRestrictionsArray.length; ++nGO) {
						additionalRestrictionsArray[nGO].trim();
						// Get GameObject id; check it exists
						sRestrictionGOKey = Mashups.getGameObjectKey(additionalRestrictionsArray[nGO]);
						if (null === sRestrictionGOKey) {
							this.reply(`Additionally restricted GameObject: "${additionalRestrictionsArray[nGO]}" could not be identified!`);
							return;
						}
						params.additionalRestrictions[nAdditionalRestrictionCount] = sRestrictionGOKey;
						nAdditionalRestrictionCount++;
					}
				}
				break;
				case eCommandParam.CustomTitle: // customTitle
					if ((args[i]) && ('' !== args[i])) {
						params.customTitle = args[i];
					}
					break;
				case eCommandParam.TimeToStart: // timeToStart
					params.timeToStart = args[i];
					break;
				case eCommandParam.AutoDQ: // autodq
					params.autodq = args[i];
					break;
			}
		}
		// Old but useful?
		/*
		if (params.baseFormat) { // FIXME: Need to subsplit here
			var format = Tools.parseAliases(params.baseFormat);
			if (!Formats[format] || !Formats[format].chall) return this.reply(this.trad('e31') + ' ' + format + ' ' + this.trad('e32'));
			details.format = format;
		}
		*/

		// Reset module globals
		extractedRuleArray = [];
		nExtractedRuleCount = 0;
		extractedBanArray = [];
		nExtractedBanCount = 0;
		extractedUnbanArray = [];
		nExtractedUnbanCount = 0;
		extractedRestrictionArray = [];
		nExtractedRestrictionCount = 0;

		// Determine format name and base format
		var sFormatName = Formats[params.baseFormat].name;
		if (params.useCompression) {
			sFormatName = toId(sFormatName);
		}
		baseFormatDetails = Mashups.findFormatDetails(params.baseFormat);
		if(Mashups.MASHUPS_DEBUG_ON) this.reply(`DEBUG baseFormatDetails: ${JSON.stringify(baseFormatDetails)}`);
		if(null === baseFormatDetails) {
			this.reply(`Could not find format details for ${params.baseFormat}! format.js may not be updated yet.`);
			return;
		}
		nBaseGen = Mashups.determineFormatGen(baseFormatDetails);
		if(Mashups.MASHUPS_DEBUG_ON) monitor(`DEBUG nBaseGen: ${nBaseGen}`);
		var nBaseFormatTierId = Mashups.determineFormatBasisTierId(baseFormatDetails, nBaseGen);
		if(Mashups.MASHUPS_DEBUG_ON) monitor(`DEBUG nBaseFormatTierId: ${nBaseFormatTierId}`);
		nBaseGameType = Mashups.determineFormatGameTypeId(baseFormatDetails);
		sBaseModName = Mashups.determineFormatMod(baseFormatDetails);
		baseFormatTierDetails = Mashups.findTierFormatDetails(nBaseFormatTierId, nBaseGen);
		if(Mashups.MASHUPS_DEBUG_ON) this.reply(`DEBUG baseFormatTierDetails: ${JSON.stringify(baseFormatTierDetails)}`);
		if(null === baseFormatTierDetails) {
			this.reply(`Could not find any format to use as base tier! (Gen: ${nBaseGen}, Tier Id: ${nBaseFormatTierId}`);
			return;
		}

		var nAddOn;
		var addOnFormat;
		var nRuleItr;

		// Check same meta is not included multiple times (pointless, fatal error)
		if (params.addOnFormats) {
			var nSubAddOn;
			var subAddOnFormat;
			for (nAddOn = 0; nAddOn < params.addOnFormats.length; ++nAddOn) {
				addOnFormat = Mashups.findFormatOrRulesetAsFormatDetails(params.addOnFormats[nAddOn]);

				if(!addOnFormat) {
					this.reply(`Unknown add-on! : ${params.addOnFormats[nAddOn]}`);
					return;
				}

				// Check add-on is not the same as the base
				if(baseFormatDetails.name === addOnFormat.name) {
					this.reply(`An add-on format is the same as the base! : ${addOnFormat.name}`);
					return;
				}

				// Check same add-on is not included multiple times
				for (nSubAddOn = nAddOn+1; nSubAddOn < params.addOnFormats.length; ++nSubAddOn) {
					if(nAddOn === nSubAddOn) continue;
					subAddOnFormat = Mashups.findFormatOrRulesetAsFormatDetails(params.addOnFormats[nSubAddOn]);
					if(addOnFormat.name === subAddOnFormat.name) {
						this.reply(`An add-on format appeared multiple times! : ${addOnFormat.name}`);
						return;
					}
				}
			}
		}

		// Put all involved metas into an array for robust accessing
		var sMetaArray = [params.baseFormat];
		var metaDetailsArray = [baseFormatDetails];
		if (params.addOnFormats) {
			for (nAddOn = 0; nAddOn < params.addOnFormats.length; ++nAddOn) {
				sMetaArray[nAddOn+1] = params.addOnFormats[nAddOn];
				metaDetailsArray[nAddOn+1] = Mashups.findFormatOrRulesetAsFormatDetails(params.addOnFormats[nAddOn]);
			}
		}

		// Determine tier
		nTierId = nBaseFormatTierId; // Assume the base format's tier by default
		bTierModified = false;
		bTierIncreased = false;
		// Search add-ons for tier-altering formats
		var nTierFormatAddOnIdx = -1;
		var nTierFormatMetaIdx = -1;
		var nLoopTierId;
		if (params.addOnFormats) {
			for (nAddOn = 0; nAddOn < params.addOnFormats.length; ++nAddOn) {
				addOnFormat = Mashups.findFormatOrRulesetAsFormatDetails(params.addOnFormats[nAddOn]);
				if(!addOnFormat) continue;
				if(!addOnFormat.name) continue;

				nLoopTierId = Mashups.determineFormatDefinitionTierId(addOnFormat.name, nBaseGen);
				if( -1 !== nLoopTierId ) {
					// Found matching tier
					if(-1 !== nTierFormatAddOnIdx) {
						this.reply(`Found conflicting tier candidates, including : ${Mashups.tierDataArray[nTierId].name} and ${Mashups.tierDataArray[nLoopTierId].name}!`);
						return;
					}
					nTierId = nLoopTierId;
					nTierFormatAddOnIdx = nAddOn;
					nTierFormatMetaIdx = nAddOn + 1;
					bTierModified = true;
				}
			}
		}
		if( -1 === nTierFormatMetaIdx ) { // If no add-on modifies the tier, check if the base is a tier-defining format
			if(Mashups.isFormatTierDefinition(sFormatName, nBaseGen)) {
				nTierFormatMetaIdx = 0;
			}
		}
		bIsLC = (Mashups.Tier.LC == nTierId) || (Mashups.Tier.LCUbers == nTierId);
		if(Mashups.MASHUPS_DEBUG_ON) monitor(`DEBUG Using tier format: ${Mashups.tierDataArray[nTierId].name}`);

		// Deconstruct tier and build up bans atomically so they can be edited properly
		var nDeltaTier = nBaseFormatTierId - nTierId;
		var deltaUnbanArray = [];
		var nDeltaUnbanCount = 0;
		var bIsUbersBase = Mashups.tierDataArray[nTierId].isUbers;
		var bReachedLimit = false;
		var nRecursiveTierId;
		var bFirstLoop = true;
		var formatDetails;
		var sTierName;
		var nTierParent;
		if(nDeltaTier < 0) { // Final tier is reduced from base by an add-on tier format
			nRecursiveTierId = nTierId;
			while(!bReachedLimit) {
				sTierName = Mashups.tierDataArray[nRecursiveTierId].name;
				//monitor(`sTierName: ${sTierName}`);

				// Extract rules if this tier has a format
				formatDetails = Mashups.findFormatDetails(Mashups.getGenName(nBaseGen) + sTierName);
				if(null !== formatDetails) {
					//monitor(`Extract tier`);
					ExtractFormatRules(formatDetails, params, true);
				}

				// Ban the whole tier if it is above base
				if(!bFirstLoop) {
					TryAddBan(sTierName, params, nRecursiveTierId);
				}

				// Move on to next tier or end
				nTierParent = Mashups.tierDataArray[nRecursiveTierId].parent;
				//monitor(`nTierParent: ${nTierParent}`);
				if( (nTierParent <= nBaseFormatTierId) ||
					(Mashups.Tier.Undefined === nTierParent) ||
					(!bIsUbersBase && Mashups.tierDataArray[nTierParent].isUbers) )
				{
					bReachedLimit = true;
				}
				else {
					nRecursiveTierId = nTierParent;
				}

				bFirstLoop = false;
			}
		}
		else if(nDeltaTier > 0) { // Final tier is increased over base by an add-on tier format
			bTierIncreased = true;
			nRecursiveTierId = nBaseFormatTierId;
			var nDeltaUnbanIndexOf;
			while(!bReachedLimit) {
				sTierName = Mashups.tierDataArray[nRecursiveTierId].name;
				//monitor(`sTierName: ${sTierName}`);

				// Extract rules if this tier has a format (only needed if above base)
				formatDetails = Mashups.findFormatDetails(Mashups.getGenName(nBaseGen) + sTierName);
				if(!bFirstLoop) {
					if(null !== formatDetails) {
						//monitor(`Extract tier`);
						ExtractFormatRules(formatDetails, params, true);
					}
				}

				// Determine if this will be the final loop
				nTierParent = Mashups.tierDataArray[nRecursiveTierId].parent;
				//monitor(`nTierParent: ${nTierParent}`);
				if( (nTierParent < nTierId) ||
					(Mashups.Tier.Undefined === nTierParent) /*||
					(!bIsUbersBase && Mashups.tierDataArray[nTierParent].isUbers)*/ )
				{
					bReachedLimit = true;
				}
				else {
					nRecursiveTierId = nTierParent;
				}

				// Prevent unbans from previous tiers if they are rebanned in the upper tier
				if(null !== formatDetails) {
					//monitor(`Extract bans for rebanning`);
					if(formatDetails.banlist) {
						for(nRuleItr = 0; nRuleItr < formatDetails.banlist.length; ++nRuleItr) {
							nDeltaUnbanIndexOf = deltaUnbanArray.indexOf(formatDetails.banlist[nRuleItr]);
							if(nDeltaUnbanIndexOf < 0) continue;
							deltaUnbanArray[nDeltaUnbanIndexOf] = null;
						}

						deltaUnbanArray = deltaUnbanArray.filter(function (el) {
							return el != null;
						});
						nDeltaUnbanCount = deltaUnbanArray.length;
					}
				}

				// Prepare to unban all the bans in the tier if we haven't reached limit
				if(!bReachedLimit) {
					if(null !== formatDetails) {
						//monitor(`Extract bans so we can reverse them`);
						if(formatDetails.banlist) {
							for(nRuleItr = 0; nRuleItr < formatDetails.banlist.length; ++nRuleItr) {
								if(deltaUnbanArray.includes(formatDetails.banlist[nRuleItr])) continue;
								deltaUnbanArray[nDeltaUnbanCount++] = formatDetails.banlist[nRuleItr];
							}
						}
					}
				}

				bFirstLoop = false;
			}

			// Delta unban Pokemon from the base format tiered below the new tier
			var goAsPoke;
			for(nRuleItr = 0; nRuleItr < baseFormatDetails.banlist.length; ++nRuleItr) {
				goAsPoke = Mashups.getGameObjectAsPokemon(baseFormatDetails.banlist[nRuleItr]);
				if(goAsPoke) { // As Pokemon checks
					var nPokeTier = Mashups.calcPokemonTier(goAsPoke);
					//monitor(`${goAsPoke.name}: nPokeTier: ${nPokeTier}, nTierId: ${nTierId}`);
					if(!Mashups.isABannedInTierB(nPokeTier, nTierId)) {
						deltaUnbanArray[nDeltaUnbanCount++] = baseFormatDetails.banlist[nRuleItr];
					}
				}
			}

			// Effect the delta unbans
			for(nRuleItr = 0; nRuleItr < deltaUnbanArray.length; ++nRuleItr) {
				TryAddUnban(deltaUnbanArray[nRuleItr], params, nTierId, true);
			}
		}
		// Otherwise, the base and final tier match, so we don't need to do anything

		// Determine tour name
		{ // FIXME: Make tier meta last
			var sGenStrippedName;
			var nAAAIdx = -1;
			var sAAAPlaceholderToken = '@@@';
			var sMnMPlaceholderToken = '$$$';
			var bIncludesMnM = false;
			var bIncludesSubstantiveNonMnM = false;
			var bIncludesStabmons = false;

			var sMetaNameBasis;
			var sReplacePlaceholderContent;

			var sTourName = Mashups.getGenNameDisplayFormatted(nBaseGen) + ' ';
			for(var nMetaItr = 0; nMetaItr < sMetaArray.length; ++nMetaItr) {
				if(nMetaItr === nTierFormatMetaIdx) continue; // Tier-defining format should always go last

				// Special cases
				sGenStrippedName = Mashups.genStripName(sMetaArray[nMetaItr]);
				switch(sGenStrippedName) {
					case 'almostanyability':
						nAAAIdx = nMetaItr;
						sTourName += sAAAPlaceholderToken;
						continue;
					case 'mixandmega':
						bIncludesMnM = true;
						sTourName += sMnMPlaceholderToken;
						continue;
					case 'stabmons':
						bIncludesStabmons = true;
						bIncludesSubstantiveNonMnM = true;
						break;
					default:
						if(nTierFormatMetaIdx !== nMetaItr) {
							bIncludesSubstantiveNonMnM = true;
						}
						break;
				}

				// Spacing
				if(nMetaItr > 0) sTourName += ' ';

				// Append name as normal
				if(metaDetailsArray[nMetaItr]) {
					sMetaNameBasis = Mashups.genStripName(metaDetailsArray[nMetaItr].name);
				}
				else {
					sMetaNameBasis = sMetaArray[nMetaItr];
				}
				sTourName += sMetaNameBasis;
			}

			// Post-process for special case meta names
			if(bIncludesMnM) {
				sReplacePlaceholderContent = '';
				if(bIncludesSubstantiveNonMnM) {
					sTourName += ' n Mega';
				}
				else {
					sReplacePlaceholderContent = 'Mix and Mega';
				}
				sTourName = sTourName.replace(sMnMPlaceholderToken, sReplacePlaceholderContent);
			}
			if( nAAAIdx >= 0 ) {
				sReplacePlaceholderContent = '';
				if(sTourName.includes('STABmons')) { // Prioritise stabmons
					sTourName = sTourName.replace('STABmons', 'STAAABmons');
				}
				else if(sTourName.includes('a')) { // Replace letter a/A if we can
					sTourName = sTourName.replace('a', 'AAA');
				}
				else if(sTourName.includes('A')) {
					sTourName = sTourName.replace('A', 'AAA');
				}
				else { // Otherwise just fill in as AAA in ordered place
					if(0 === nAAAIdx) {
						sReplacePlaceholderContent += 'AAA';
					}
					else {
						sReplacePlaceholderContent += ' AAA';
					}
				}
				sTourName = sTourName.replace(sAAAPlaceholderToken, sReplacePlaceholderContent);
			}
			if(-1 !== nTierFormatMetaIdx) {
				sTourName += ' ';

				// Append name as normal
				if(metaDetailsArray[nTierFormatMetaIdx]) {
					sMetaNameBasis = Mashups.genStripName(metaDetailsArray[nTierFormatMetaIdx].name);
				}
				else {
					sMetaNameBasis = sMetaArray[nTierFormatMetaIdx];
				}
				sTourName += sMetaNameBasis;
			}

			// Remove double spaces
			sTourName = sTourName.replace('  ', ' ');

			// Custom name option
			if (params.customTitle) {
				sTourName = params.customTitle;
			}
		}

		// Determine tour rules
		var tourRulesArray = [];
		var nTourRuleCount = 0;
		{
			// Add rules from add-ons
			if (params.addOnFormats) {
				if(Mashups.MASHUPS_DEBUG_ON) monitor(`DEBUG reached addOnFormats`);

				// Add rules created through format-stacking
				for ( nAddOn = 0; nAddOn < params.addOnFormats.length; ++nAddOn) {
					addOnFormat = Mashups.findFormatOrRulesetAsFormatDetails(params.addOnFormats[nAddOn]);
					if(!Mashups.doesFormatHaveKeyCustomCallbacks(addOnFormat)) continue;

					// Format has custom callbacks and must be stacked to make them effective
					extractedRuleArray[nExtractedRuleCount] = addOnFormat.name;
					nExtractedRuleCount++;

					// Add to stacked dictionary
					formatStackedAddOnsDictionary[addOnFormat.name] = true;
				}

				var nExistingRuleItr;
				var bIgnoreRule;
				var sCurrentRule;
				for ( nAddOn = 0; nAddOn < params.addOnFormats.length; ++nAddOn) {
					//addOnFormat = Formats[params.addOnFormats[nAddOn]];
					addOnFormat = Mashups.findFormatOrRulesetAsFormatDetails(params.addOnFormats[nAddOn]);
					if(Mashups.MASHUPS_DEBUG_ON) monitor(`DEBUG addOnFormats[${nAddOn}]: ${JSON.stringify(addOnFormat)}`);

					// Don't do anything here with a tier add-on, as that should be handled above
					if(nTierFormatAddOnIdx === nAddOn) {
						if(Mashups.MASHUPS_DEBUG_ON) monitor(`DEBUG Ignoring as tier format...`);
						continue;
					}

					ExtractFormatRules(addOnFormat, params);

					// Format-exclusive unique behaviours
					if(!addOnFormat) continue;
					switch(Mashups.genStripName(toId(addOnFormat.name))) {
						case 'cap':
						if (extractedUnbanArray) {
							extractedUnbanArray[nExtractedUnbanCount++] = 'Crucibellite';
							deltaUnbanArray[nDeltaUnbanCount++] = 'Crucibellite';
						}
						break;
					}
				}
			}

			// Post-processes
			if(extractedUnbanArray) { // Cull extracted unbans that aren't included in base and every add-on (unbans are an intersection not union)
				var goAsPoke;
				var nPokeTier;
				for (var nRuleItr = 0; nRuleItr < extractedUnbanArray.length; ++nRuleItr) {
					// Delta unbans are whitelisted
					if(deltaUnbanArray.includes(extractedUnbanArray[nRuleItr])) continue;

					// Whitelist pokes that have been legalised by final tier to support ubers, etc
					goAsPoke = Mashups.getGameObjectAsPokemon(extractedUnbanArray[nRuleItr]);
					if(goAsPoke) { // As Pokemon checks
						nPokeTier = Mashups.calcPokemonTier(goAsPoke);
						if(!Mashups.isABannedInTierB(nPokeTier, nTierId)) {
							continue;
						}
					}

					// Nullify unbans that are banned by base format
					if(!baseFormatDetails.unbanlist || (!baseFormatDetails.unbanlist.includes(extractedUnbanArray[nRuleItr]))) {
						extractedUnbanArray[nRuleItr] = null;
						continue;
					}

					if (params.addOnFormats) { // Nullify unbans that are banned by any add-on
						for ( nAddOn = 0; nAddOn < params.addOnFormats.length; ++nAddOn) {
							addOnFormat = Mashups.findFormatOrRulesetAsFormatDetails(params.addOnFormats[nAddOn]);
							if(!addOnFormat) continue;

							if(!addOnFormat.unbanlist || !addOnFormat.unbanlist.includes(extractedUnbanArray[nRuleItr])) {
								extractedUnbanArray[nRuleItr] = null;
								continue;
							}
						}
					}
				}

				extractedUnbanArray = extractedUnbanArray.filter(function (el) {
					return el != null;
				});

				nExtractedUnbanCount = extractedUnbanArray.length;
			}

			// Deal with Gen 9 NatDex problems
			if ((9 === nBaseGen) && IsRuleIncluded('Standard NatDex', params)) {
				const sMinSourceGenRule = 'Min Source Gen = 9';
				if (IsRuleIncluded(sMinSourceGenRule, params)) {
					extractedRuleArray?.pop('Min Source Gen = 9');
				}
				else if (baseFormatDetails.ruleset.includes(sMinSourceGenRule)) {
					TryAddRule('!! Min Source Gen = 1', params, null, false);
				}
				TryAddUnban('Unreleased', params, null, false);
			}

			// Special cases
			var sGenericMetaName = Mashups.genericiseMetaName(sFormatName);
			if(Mashups.MASHUPS_DEBUG_ON) monitor(`DEBUG sGenericMetaName: ${sGenericMetaName}`);
			switch(sGenericMetaName) {
				case 'mixandmega': {
						var restrictedArray = [];
						if (baseFormatDetails.restricted) restrictedArray = restrictedArray.concat(baseFormatDetails.restricted);
						if (params.additionalRestrictions) restrictedArray = restrictedArray.concat(params.additionalRestrictions);
						if (extractedRestrictionArray) restrictedArray = restrictedArray.concat(extractedRestrictionArray);
						if(Mashups.MASHUPS_DEBUG_ON) monitor(`DEBUG restrictedArray: ${restrictedArray.length}`);
						var unrestrictedArray = [];
						var unrestrictedCount = 0;
						for (nRuleItr = 0; nRuleItr < restrictedArray.length; ++nRuleItr) {
							var goAsPokemon = Mashups.getGameObjectAsPokemon(restrictedArray[nRuleItr]);
							if (!goAsPokemon) continue;
							if (extractedUnbanArray && extractedUnbanArray.includes(restrictedArray[nRuleItr]) ) {
								unrestrictedArray[unrestrictedCount++] = restrictedArray[nRuleItr];
							}
							else if (params.additionalUnbans && params.additionalUnbans.includes(restrictedArray[nRuleItr]) ) {
								unrestrictedArray[unrestrictedCount++] = restrictedArray[nRuleItr];
							}
						}
						if(Mashups.MASHUPS_DEBUG_ON) monitor(`DEBUG unrestrictedCount: ${unrestrictedCount}`);
						if (unrestrictedCount > 0) {
							var megaStoneArray = [];
							for (const itemValue of Object.values(Mashups.ItemsArray)) {
								if (!itemValue) continue;
								if (!itemValue.megaStone) continue;
								megaStoneArray.push(itemValue.name);
							}
							if(Mashups.MASHUPS_DEBUG_ON) monitor(`DEBUG megaStoneArray: ${megaStoneArray}`);
							var itemItr;
							for (nRuleItr = 0; nRuleItr < unrestrictedArray.length; ++nRuleItr) {
								for (itemItr = 0; itemItr < megaStoneArray.length; ++itemItr) {
									extractedBanArray[nExtractedBanCount++] = unrestrictedArray[nRuleItr] + ' + ' + megaStoneArray[itemItr];
								}
							}
						}
					}
					break;
			}

			// 20/08/02: New restrictions system
			// Convert restrictions to complex bans
			/*if(params.useRestrictions && (nExtractedRestrictionCount > 0) ) {
				var pokedexKeys = Object.keys(Mashups.PokedexArray);
				var nPokeItr;
				var sPokeName;
				var pokeGO;
				var sTypeName;
				for (var nRuleItr = 0; nRuleItr < extractedRestrictionArray.length; ++nRuleItr) {
					var goAsMove = Mashups.getGameObjectAsMove(extractedRestrictionArray[nRuleItr]);
					if(goAsMove) { // As Move checks
						// Only STABmons adds moves as restrictions currently
						if(!goAsMove.type) continue;
						if(!goAsMove.name) continue;
						sTypeName = goAsMove.type;
						for (nPokeItr = 0; nPokeItr < pokedexKeys.length; ++nPokeItr) {
							sPokeName = pokedexKeys[nPokeItr];
							// Don't complex ban the move if we actually learn it
							if(Mashups.doesPokemonLearnMove(sPokeName, goAsMove.name) ) continue;

							// Don't complex ban the move if we could learn it through Sketch
							if(Mashups.doesPokemonLearnMove(sPokeName, 'Sketch') ) continue;

							// Don't need complex ban if we don't have the typing to get it from STABmons Rule
							if(!Mashups.DoesPokemonHavePreBattleAccessToTyping(pokedexKeys[nPokeItr], sTypeName, true) ) continue;

							pokeGO = Mashups.getGameObjectAsPokemon(sPokeName);
							if(pokeGO && pokeGO.species) {
								sPokeName = pokeGO.species;
							}

							extractedBanArray[nExtractedBanCount++] = sPokeName + ' + ' + goAsMove.name;
						}
					}
				}
			}*/

			// Generate warning list
			var warningArray = [];
			if (params.addOnFormats) {
				var nAddOnGameType;
				var nAddOnGen;
				var sAddOnMod;
				var sWarningStatement;
				var sGenericMetaName;
				var sGOKey;
				for ( nAddOn = 0; nAddOn < params.addOnFormats.length; ++nAddOn) {
					addOnFormat = Mashups.findFormatOrRulesetAsFormatDetails(params.addOnFormats[nAddOn]);
					if(!addOnFormat) continue;

					// Mod conflict check - this is almost certain to be a fatal problem
					sAddOnMod = Mashups.determineFormatMod(addOnFormat);
					if( (sAddOnMod !== sBaseModName) && (!Mashups.isDefaultModName(sAddOnMod)) ) {
						sWarningStatement = `Mod Conflict: "${sAddOnMod}" in add-on "${addOnFormat.name}" conflicts with base mod "${sBaseModName}"!`;
						warningArray.push(sWarningStatement);
					}

					// Whitelist certain add-ons that we know will work cross-gen/gametype
					sGenericMetaName = Mashups.genericiseMetaName(addOnFormat.name);
					switch(sGenericMetaName) {
						case 'almostanyability':
						case 'stabmons':
						case 'balancedhackmons':
						continue;
					}

					// GameType conflict check
					nAddOnGameType = Mashups.determineFormatGameTypeId(addOnFormat);
					if(nAddOnGameType !== nBaseGameType) {
						sWarningStatement = `GameType Conflict: gametype "${Mashups.GameTypeDataArray[nAddOnGameType].name}" of add-on "${addOnFormat.name}" conflicts with base gametype "${Mashups.GameTypeDataArray[nBaseGameType].name}"!`;
						warningArray.push(sWarningStatement);
					}

					// Gen conflict check
					nAddOnGen = Mashups.determineFormatGen(addOnFormat);
					if(nAddOnGen !== nBaseGen) {
						sWarningStatement = `Generation Conflict: addOn "${addOnFormat.name}" is [Gen ${nAddOnGen.toString()}] but base format is [Gen ${nBaseGen.toString()}]!`;
						warningArray.push(sWarningStatement);
					}
				}

				if(params.additionalBans) { // Check param bans are real GameObjects
					for(nRuleItr = 0; nRuleItr < params.additionalBans.length; ++nRuleItr) {
						// Get GameObject id; check it exists
						sGOKey = Mashups.getGameObjectKey(params.additionalBans[nRuleItr]);
						if(sGOKey) continue;
						sWarningStatement = `Unidentified additional ban: "${params.additionalBans[nRuleItr]}" could not be identified as a real GameObject!`;
						warningArray.push(sWarningStatement);
					}
				}
				if(params.additionalUnbans) { // Added param unbans
					for(nRuleItr = 0; nRuleItr < params.additionalUnbans.length; ++nRuleItr) {
						// Get GameObject id; check it exists
						sGOKey = Mashups.getGameObjectKey(params.additionalUnbans[nRuleItr]);
						if(sGOKey) continue;
						sWarningStatement = `Unidentified additional unban: "${params.additionalUnbans[nRuleItr]}" could not be identified as a real GameObject!`;
						warningArray.push(sWarningStatement);
					}
				}
			}

			// Lock bans/unbans/restrictions at this point and concatenate '+'/'-'/'*'
			if(extractedBanArray) { // Inherent bans
				for (nRuleItr = 0; nRuleItr < extractedBanArray.length; ++nRuleItr) {
					extractedBanArray[nRuleItr] = '-' + extractedBanArray[nRuleItr];
				}
			}
			if(params.additionalBans) { // Added param bans
				for (nRuleItr = 0; nRuleItr < params.additionalBans.length; ++nRuleItr) {
					params.additionalBans[nRuleItr] = '-' + params.additionalBans[nRuleItr];
				}
			}
			if(extractedUnbanArray) { // Inherent unbans
				for (nRuleItr = 0; nRuleItr < extractedUnbanArray.length; ++nRuleItr) {
					extractedUnbanArray[nRuleItr] = '+' + extractedUnbanArray[nRuleItr];
				}
			}
			if(params.additionalUnbans) { // Added param unbans
				for (nRuleItr = 0; nRuleItr < params.additionalUnbans.length; ++nRuleItr) {
					params.additionalUnbans[nRuleItr] = '+' + params.additionalUnbans[nRuleItr];
				}
			}
			if(extractedRestrictionArray) { // Inherent restrictions
				for (nRuleItr = 0; nRuleItr < extractedRestrictionArray.length; ++nRuleItr) {
					extractedRestrictionArray[nRuleItr] = '*' + extractedRestrictionArray[nRuleItr];
				}
			}
			if(params.additionalRestrictions) { // Added param restrictions
				for (nRuleItr = 0; nRuleItr < params.additionalRestrictions.length; ++nRuleItr) {
					params.additionalRestrictions[nRuleItr] = '*' + params.additionalRestrictions[nRuleItr];
				}
			}

			// Construct final rules array from concatenated content
			if (extractedRuleArray) { // Put inherent rules in first
				tourRulesArray = tourRulesArray.concat(extractedRuleArray);
			}
			if (params.additionalRules) { // Then added param rules
				tourRulesArray = tourRulesArray.concat(params.additionalRules);
			}
			if(extractedRestrictionArray) { // Inherent restrictions
				tourRulesArray = tourRulesArray.concat(extractedRestrictionArray);
			}
			if(params.additionalRestrictions) { // Added param restrictions
				tourRulesArray = tourRulesArray.concat(params.additionalRestrictions);
			}
			if(extractedBanArray) { // Inherent bans
				tourRulesArray = tourRulesArray.concat(extractedBanArray);
			}
			if(params.additionalBans) { // Added param bans
				tourRulesArray = tourRulesArray.concat(params.additionalBans);
			}
			if(extractedUnbanArray) { // Inherent unbans
				tourRulesArray = tourRulesArray.concat(extractedUnbanArray);
			}
			if(params.additionalUnbans) { // Added param unbans
				tourRulesArray = tourRulesArray.concat(params.additionalUnbans);
			}

			nTourRuleCount = tourRulesArray.length;
		}

		// Special-case default autostart/autodq for non-built formats
		const bHasTeam = baseFormatDetails.team;
		if (null === params.timeToStart) {
			params.timeToStart = bHasTeam ? 5 : 10;
		}
		if (null === params.autodq) {
			params.autodq = bHasTeam ? 2 : 7;
		}

		// Construct tour code string
		let sTourCode = '';
		sTourCode += `/tour new ${sFormatName}, ${params.type},,,${sTourName}\n`;
		if (nTourRuleCount > 0) { // Constructed rules
			sTourCode += `/tour rules `;
			for (nRuleItr = 0; nRuleItr < tourRulesArray.length; ++nRuleItr) {
				if (nRuleItr > 0) {
					sTourCode += `, `;
				}
				sTourCode += `${tourRulesArray[nRuleItr]}`;
			}
			sTourCode += `\n`;
		}
		sTourCode += `/tour autostart ${params.timeToStart}\n`;
		sTourCode += `/tour autodq ${params.autodq}\n`;
		
		// Output
		Mashups.replyInSplitCodeBlocks(this, sTourCode);

		// Print out warnings (after, so we don't hit message limit with tour code output itself)
		if(warningArray.length > 0) {
			var sWarningPlural = ( warningArray.length > 1 ) ? 'warnings' : 'warning';
			this.reply(`Code generation triggered ${warningArray.length.toString()} ${sWarningPlural}:-`);
			var sWarningStatement = '!code ';
			for(var nWarnItr=0; nWarnItr<warningArray.length; ++nWarnItr) {
				sWarningStatement += warningArray[nWarnItr];
				sWarningStatement += `\n`;
			}
			if (sWarningStatement) this.reply(sWarningStatement);
		}
	}
};
