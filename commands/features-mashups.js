/*
	Commands for Mashups room management
*/

var Mashups = exports.Mashups = require('./../features/mashups/index.js');
var TourCodeManager = exports.Mashups = require('./../features/mashups/tour-code-manager.js');
var UsageTracker = exports.UsageTracker = require('./../features/mashups/usage-tracker.js');

exports.commands = {
	resettours: 'resettourratio',
	resettourratio: function (arg, user, room, cmd) {
        if (!this.isRanked(Tools.getGroup('driver'))) return false;

        Mashups.resetCompletedTourAuthTypeArray();
        Mashups.save();

        var sAnalysisStatement = Mashups.analyseTourAuthTypeCountStatement();
	    if (sAnalysisStatement) Bot.say(room, sAnalysisStatement);
    },
    setofficialcount: 'setofficialtourscount',
    setofficialtourscount: function (arg, user, room, cmd) {
        if (!this.isRanked(Tools.getGroup('driver'))) return false;

        Mashups.setCompletedTourAuthTypeCount(Mashups.MashupAuthType.Official, parseInt(arg));
        Mashups.save();

        var sAnalysisStatement = Mashups.analyseTourAuthTypeCountStatement();
	    if (sAnalysisStatement) Bot.say(room, sAnalysisStatement);
    },
    setspotlightcount: 'setspotlighttourscount',
    setspotlighttourscount: function (arg, user, room, cmd) {
        if (!this.isRanked(Tools.getGroup('driver'))) return false;

        Mashups.setCompletedTourAuthTypeCount(Mashups.MashupAuthType.Spotlight, parseInt(arg));
        Mashups.save();

        var sAnalysisStatement = Mashups.analyseTourAuthTypeCountStatement();
	    if (sAnalysisStatement) Bot.say(room, sAnalysisStatement);
    },
    setothercount: 'setothertourscount',
    setothertourscount: function (arg, user, room, cmd) {
        if (!this.isRanked(Tools.getGroup('driver'))) return false;

        Mashups.setCompletedTourAuthTypeCount(Mashups.MashupAuthType.Other, parseInt(arg));
        Mashups.save();

        var sAnalysisStatement = Mashups.analyseTourAuthTypeCountStatement();
	    if (sAnalysisStatement) Bot.say(room, sAnalysisStatement);
    },
    analysetours: 'analysetourratio',
	analysetourratio: function (arg, user, room, cmd) {
        if (!this.isRanked(Tools.getGroup('voice'))) return false;

        var sAnalysisStatement = Mashups.analyseTourAuthTypeCountStatement();
	    if (sAnalysisStatement) Bot.say(room, sAnalysisStatement);
    },
    refresh: 'refreshtourcodes',
	refreshtourcodes: function (arg, user, room, cmd) {
        if (!this.isRanked(Tools.getGroup('driver'))) return false;

        if ('' === arg) {
            TourCodeManager.refreshTourCodeCache(room);
            this.reply(`Attempting to refresh tour code cache...`);
        } else {
            const validFormatKey = TourCodeManager.replyToSearchValidDynamicFormatKey(this, arg);
            if(!validFormatKey) return;

            TourCodeManager.refreshSingleFormatCache(validFormatKey, room);
        }
    },
    ctc: 'checkcachedtourcodes',
    checktourcodes: 'checkcachedtourcodes',
	checkcachedtourcodes: function (arg, user, room, cmd) {
        if (!this.isRanked(Tools.getGroup('voice'))) return false;

        var sNames = TourCodeManager.nameCachedTourCodes();
        this.reply('!code ' + sNames);
    },
    start: 'starttour',
	starttour: function (arg, user, room, cmd) {
        if (!this.isRanked(Tools.getGroup('driver'))) return false;

        const validFormatKey = TourCodeManager.replyToSearchValidDynamicFormatKey(this, arg);
        if (!validFormatKey) return;
        
        var output = TourCodeManager.searchTourCode(validFormatKey);
        
        // Try to add scrappie leaderboard trigger for non-random tours
        var randomFormatTourKeyArray = TourCodeManager.trySearchTourCodeElement('random');
        if (randomFormatTourKeyArray && !randomFormatTourKeyArray.includes(validFormatKey)) {
            output += '\n' + '.official';
        }

        this.reply(output);
    },
    preview: 'previewtour',
	previewtour: function (arg, user, room, cmd) {
        if (!this.isRanked(Tools.getGroup('voice'))) return false;

        const validFormatKey = TourCodeManager.replyToSearchValidDynamicFormatKey(this, arg);
        if(!validFormatKey) return;

        const sTourCode = TourCodeManager.searchTourCode(validFormatKey);
        Mashups.replyInSplitCodeBlocks(this, sTourCode);
    },
    write: 'writetour',
    writetour: function (arg, user, room, cmd) {
        if (!this.isRanked(Tools.getGroup('driver'))) return false;

        const bHasDirectWriteAccess = this.isRanked(Tools.getGroup('moderator'));
        TourCodeManager.requestWriteTourCode(this, arg, user, room, bHasDirectWriteAccess);
    },
    randtour: 'randomtour',
    randomtour: function (arg, user, room, cmd) {
        if (!this.isRanked(Tools.getGroup('driver'))) return false;

        const sResult = TourCodeManager.tryGetRandomTourCodeForCategory(this, arg);
        if (!sResult) return;

        this.reply(sResult);
    },
    previewrandtour: 'previewrandomtour',
    previewrandomtour: function (arg, user, room, cmd) {
        if (!this.isRanked(Tools.getGroup('voice'))) return false;

        const sResult = TourCodeManager.tryGetRandomTourCodeForCategory(this, arg);
        if (!sResult) return;

        this.reply('!code ' + sResult);
    },
    ts: 'tourcodesearch',
    toursearch: 'tourcodesearch',
    tourcodesearch: function (arg, user, room, cmd) {
        if (!this.isRanked(Tools.getGroup('voice'))) return false;

        const sResult = TourCodeManager.tryTourCodeSearch(this, arg);
        if (!sResult) return;

        this.reply('!code ' + sResult.join(', '));
    },
    mashup: 'tier',
    om: 'tier',
    tier: function (arg, user, room, cmd) {
        if (!this.isRanked(Tools.getGroup('voice'))) return false;

        const validFormatKey = TourCodeManager.replyToSearchValidDynamicFormatKey(this, arg);
        if(!validFormatKey) return;

        const formatRaw = TourCodeManager.generateDynamicFormatRaw(validFormatKey);
        if(!formatRaw) {
            this.reply(`generateDynamicFormatRaw failed for format: ` + arg);
            return;
        }

        var sOutput = '!code ';

        // Name
        sOutput += formatRaw.name;

        // Description
        if (formatRaw.description) {
            sOutput += '\n';
            sOutput += formatRaw.description;
        }

        // Resource threads
        // 20/02/13: Seems pointless unless we can output in HTML
        /*const baseFormatDetails = formatRaw.baseFormatDetails;
        if (baseFormatDetails) {
            let combinedThreadsArray = [];
            if(baseFormatDetails.threads) {
                // Base format vanilla threads
                combinedThreadsArray = combinedThreadsArray.concat(baseFormatDetails.threads);
                combinedThreadsArray = combinedThreadsArray.map(sItem => sItem.replace(`">`, `">Vanilla `));
            }
            // Mashup generic resources
            let sGenericThread = 'Resources: '+TourCodeManager.GenericResourcesLink;
            combinedThreadsArray.unshift(sGenericThread);
            sOutput += '\n';
            sOutput += combinedThreadsArray.join('\n');
        }*/

        // Ruleset
        var rulesArray = formatRaw.rulesArray;
        if (rulesArray && rulesArray.length > 0) {
            sOutput += '\n\n';
            sOutput += 'Ruleset: ';
            sOutput += TourCodeManager.formatRulesArrayForDispay(rulesArray);
        }

        // Bans
        var bansArray = formatRaw.bansArray;
        if (bansArray && bansArray.length > 0) {
            sOutput += '\n\n';
            sOutput += 'Bans: ';
            sOutput += TourCodeManager.formatRulesArrayForDispay(bansArray);
        }

        // Unbans
        var unbansArray = formatRaw.unbansArray;
        if (unbansArray && unbansArray.length > 0) {
            sOutput += '\n\n';
            sOutput += 'Unbans: ';
            sOutput += TourCodeManager.formatRulesArrayForDispay(unbansArray);
        }

        // Restricted
        var restrictedArray = formatRaw.restrictedArray;
        if (restrictedArray && restrictedArray.length > 0) {
            sOutput += '\n\n';
            sOutput += 'Restricted: ';
            sOutput += TourCodeManager.formatRulesArrayForDispay(restrictedArray);
        }

        // Tour Code URL
        const sURL = TourCodeManager.searchTourCodeURL(validFormatKey);
        if (sURL) {
            sOutput += '\n\n';
            sOutput += 'Tour Code URL: '+sURL;
        }

        this.reply(sOutput);
    },
    schedule: 'dailyschedule',
    dailyschedule: function (arg, user, room, cmd) {
        if (!this.isRanked(Tools.getGroup('voice'))) return false;

        var sOutput = '!code ';

        var upcomingDailyData = TourCodeManager.calcUpcomingDailyData();

        if (upcomingDailyData) {
            sOutput += `Next daily: ${TourCodeManager.DailyCycleDictionary[upcomingDailyData.soonestDailyKey].formatgroup} in `;
            if(upcomingDailyData.hoursLeft > 0) {
                sOutput += `${upcomingDailyData.hoursLeft} hours, `;
            }
            sOutput += `${upcomingDailyData.minutesLeft} minutes.`;
        }

        sOutput += '\n\nThis is the OM Mashups daily tour schedule:-\n';
        //sOutput += '<br><div class="infobox">';
        var bFirstLoop = true;
        for (const key in TourCodeManager.DailyDayDictionary) {
            //console.log(key + ' is ' + TourCodeManager.DailyDayDictionary[key]);
            if (!bFirstLoop) {
                sOutput += '\n';
            }
            sOutput += key+': '+TourCodeManager.DailyDayDictionary[key].formatgroup;
            bFirstLoop = false;
        }
        //sOutput += '</div>';

        //this.reply('/addhtmlbox ' + sOutput);
        this.reply(sOutput);
    },
    genmashupformats: function (arg, user, room, cmd) {
        if (!this.isRanked(Tools.getGroup('admin'))) return false;

        this.reply(`Attempting to generate mashups format data...`);

        const bSucceeded = TourCodeManager.generateMashupFormats();
        if(bSucceeded) {
            this.reply(`Succeeded!`);
        }
        else {
            this.reply(`Failed...`);
        }
    },
    usage: 'checkusage',
    checkusage: function (arg, user, room, cmd) {
        if (!this.isRanked(Tools.getGroup('voice'))) return false;

        const validFormatKey = TourCodeManager.replyToSearchValidDynamicFormatKey(this, arg);
        if(!validFormatKey) return;

        const dynamicFormatRaw = TourCodeManager.searchDynamicFormatRaw(validFormatKey);
        if(!dynamicFormatRaw) return;
        if(!dynamicFormatRaw.name) return;

        const sTourName = dynamicFormatRaw.name;
        const sTourNameId = toId(sTourName);

        const formatLog = UsageTracker.getFormatLog(sTourNameId);
        //console.log(formatLog);
        if (!formatLog || (0 === Object.keys(formatLog).length)) {
            this.reply(`No usage data found for ${sTourName}!`);
            return;
        }

        let perPokemonUsage = {};
        let nSumUsageCount = 0;
        for (const battle of Object.values(formatLog)) {
            for (const side of Object.values(battle)) {
                if (!Array.isArray(side)) continue;
                for (const pokemon of side) {
                    if(!perPokemonUsage.hasOwnProperty(pokemon)) {
                        perPokemonUsage[pokemon] = 1;
                    }
                    else {
                        perPokemonUsage[pokemon]++;
                    }
                    nSumUsageCount++;
                }
            }
        }

        if (0 === nSumUsageCount) {
            this.reply(`Usage data is empty for ${sTourName}!`);
            return;
        }

        const usageSortedPokemonKeyArray = Object.keys(perPokemonUsage).sort(
            function(a,b) { return perPokemonUsage[b] - perPokemonUsage[a] });

        const nMaxDisplayCount = 50;
        var sOutput = `Usage for ${sTourName}:-`;
        var nDisplayItr = 0;
        for (const pokemon of usageSortedPokemonKeyArray) {
            nDisplayItr++;
            const fUsage = 100 * (perPokemonUsage[pokemon] / nSumUsageCount);
            sOutput += `\n${nDisplayItr}. ${pokemon} (${parseFloat(fUsage.toFixed(3))}%)`;
            if (nDisplayItr >= nMaxDisplayCount) break;
        }

        this.reply('!code ' + sOutput);
    },
};
