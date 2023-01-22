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
        if(!validFormatKey) return;

        this.reply(TourCodeManager.searchTourCode(validFormatKey));
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
        if (!this.isRanked(Tools.getGroup('moderator'))) return false;

        TourCodeManager.requestWriteTourCode(this, arg, user, room);
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

        var sDailyRawContent = TourCodeManager.DailyRawContent;
        var rawContentPerDayArray = sDailyRawContent.split('\n');
        var dayDictionary = {};
        var dayReferenceArray = [];
        var nDayReferenceIdx = 0;
        var splitArray, timeSplitArray, sTimeSlot, sDay, dHour, dTime, nDay, sFormatGroup;
        var spotlightStartDate = null;
        for (let sDayContent of rawContentPerDayArray) {
            sDayContent = sDayContent.replace(/ +(?= )/g,''); // Ensure the line of text is single-spaced
            //console.log(sDayContent);
            splitArray = sDayContent.split(':');
            sTimeSlot = splitArray[0];

            // Spotlight start special case
            if ('Spotlight Start' === sTimeSlot) {
                if (splitArray.length < 2) continue;

                spotlightStartDate = new Date(splitArray[1].trim());
                continue;
            }

            if (splitArray.length > 1) {
                sFormatGroup = splitArray[1].trim();
                if('spotlight' === toId(sFormatGroup)) {
                    sFormatGroup = `Spotlight (${TourCodeManager.SpotlightNamesArray[0]})`;
                }
                else {
                    for(const name of TourCodeManager.SpotlightNamesArray) {
                        //console.log(name);
                        if(toId(sFormatGroup) !== toId(name)) continue;
                        sFormatGroup = `Free (would be ${name} if it wasn't spotlight)`;
                        break;
                    }
                }
            }
            else {
                sFormatGroup = '';
            }
            timeSplitArray = sDayContent.split(',');
            sDay = timeSplitArray[0].trim();
            var nInitialHours = 0;
            if (timeSplitArray.length > 1) {
                //console.log("time Hour: " + timeSplitArray[1]);
                dHour = TourCodeManager.parseTime(timeSplitArray[1]);
                nInitialHours = TourCodeManager.parseHours(timeSplitArray[1]);
                //console.log("dHour: " + dHour);
            }
            else {
                dHour = new Date();
            }

            var nUTCHour = dHour.getUTCHours();
            var nDayOffset = (nInitialHours > 24) ? 1 : 0;
            var nDay = TourCodeManager.parseDay(sDay) + nDayOffset;
            //console.log("nUTCHour: " + nUTCHour);
            //console.log("nDay: " + nDay);

            dayDictionary[sDay] = {
                day: nDay,
                dayOffset: nDayOffset,
                hour: nUTCHour,
                formatgroup: sFormatGroup
            };

            dayReferenceArray[nDayReferenceIdx] = dayDictionary[sDay];
            nDayReferenceIdx++;
        }

        //console.log("dayDictionary:");
        //console.log(dayDictionary);

        var cycleDictionary = {};
        nDayReferenceIdx = 0;
        var nOffsetDayReferenceIdx = 0;
        for (var nCycleItr=0; nCycleItr<4; ++nCycleItr) {
            for (const sDayKey in dayDictionary) {
                nOffsetDayReferenceIdx = nDayReferenceIdx + nCycleItr;
                if (nOffsetDayReferenceIdx >= 7) {
                    nOffsetDayReferenceIdx -= 7;
                }
                const timeReference = dayReferenceArray[nOffsetDayReferenceIdx];
                //console.log(timeReference);
                const sCycleKey = `${sDayKey} ${nCycleItr}`;
                cycleDictionary[sCycleKey] = {
                    day: TourCodeManager.parseDay(sDayKey) + timeReference.dayOffset + (7*nCycleItr) + ('Sunday' === sDayKey ? 7 : -1),
                    hour: timeReference.hour,
                    formatgroup: dayDictionary[sDayKey].formatgroup
                };

                nDayReferenceIdx++;
            }
            nDayReferenceIdx = 0;
        }

        //console.log("cycleDictionary:");
        //console.log(cycleDictionary);

        // Ensure there is a spotlight start fallback
        if (!spotlightStartDate) {
            spotlightStartDate = new Date(Date.now());
        }
        //console.log(spotlightStartDate);

        var sOutput = '!code ';

        var dNow = new Date(Date.now());
        // Test
        //dNow = new Date(Date.now() + (1000*60*60*(7+0*24)));
        var nCurrentDay = dNow.getUTCDay();
        console.log("dNow: " + dNow);
        //console.log("nCurrentDay: " + nCurrentDay);

        //const nDaysSinceStartOfSpotlight = TourCodeManager.dateDiff(spotlightStartDate, dNow);
        //console.log("nDaysSinceStartOfSpotlight: " + nDaysSinceStartOfSpotlight);

        const nTimeSinceStartOfSpotlight = dNow - spotlightStartDate;
        console.log("nTimeSinceStartOfSpotlight: " + nTimeSinceStartOfSpotlight);

        var sSoonestDailyKey = null, nSoonestDailyDeltaTime;
        var dTestDate, nDeltaDays, nDeltaTime;
        /*for (let key in dayDictionary) {
            nDeltaDays = (dayDictionary[key].day < nCurrentDay) ? (7 - nCurrentDay) + dayDictionary[key].day : dayDictionary[key].day - nCurrentDay;
            dTestDate = TourCodeManager.addDays(dNow, nDeltaDays);
            dTestDate.setUTCHours(dayDictionary[key].hour);
            dTestDate.setUTCMinutes(0);
            dTestDate.setUTCSeconds(0);
            nDeltaTime = dTestDate - dNow;

            let bIsDeltaTimePositive = (nDeltaTime > 0);
            if (!bIsDeltaTimePositive) continue;

            if (!sSoonestDailyKey || (nSoonestDailyDeltaTime > nDeltaTime)) {
                sSoonestDailyKey = key;
                nSoonestDailyDeltaTime = nDeltaTime;
            }
        }*/
        for (let key in cycleDictionary) {
            dTestDate = TourCodeManager.addDays(spotlightStartDate, cycleDictionary[key].day);
            dTestDate.setUTCHours(cycleDictionary[key].hour);
            dTestDate.setUTCMinutes(0);
            dTestDate.setUTCSeconds(0);
            nDeltaTime = dTestDate - dNow;

            let bIsDeltaTimePositive = (nDeltaTime > 0);
            if (!bIsDeltaTimePositive) continue;

            if (!sSoonestDailyKey || (nSoonestDailyDeltaTime > nDeltaTime)) {
                sSoonestDailyKey = key;
                nSoonestDailyDeltaTime = nDeltaTime;

                console.log("Test sSoonestDailyKey: " + sSoonestDailyKey);
                console.log("Test nSoonestDailyDeltaTime: " + nSoonestDailyDeltaTime);
            }
        }

        if (sSoonestDailyKey) {
            console.log("sSoonestDailyKey: " + sSoonestDailyKey);
            var nSeconds = Math.floor(nSoonestDailyDeltaTime/1000);
            var nMinutes = Math.floor(nSeconds/60);
            var nHours = Math.floor(nMinutes/60);
            var nDays = Math.floor(nHours/24);
            console.log("nSeconds: " + nSeconds);
            console.log("nMinutes: " + nMinutes);
            console.log("nHours: " + nHours);
            console.log("nDays: " + nDays);

            //nHours = nHours-(nDays*24);
            nMinutes = nMinutes/*-(nDays*24*60)*/-(nHours*60);

            sOutput += `Next daily: ${cycleDictionary[sSoonestDailyKey].formatgroup} in `;
            if(nHours > 0) {
                sOutput += `${nHours} hours, `;
            }
            sOutput += `${nMinutes} minutes.`;
        }

        sOutput += '\n\nThis is the OM Mashups daily tour schedule:-\n';
        //sOutput += '<br><div class="infobox">';
        var bFirstLoop = true;
        for (const key in dayDictionary) {
            //console.log(key + ' is ' + dayDictionary[key]);
            if(!bFirstLoop) {
                sOutput += '\n';
            }
            sOutput += key+': '+dayDictionary[key].formatgroup;
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
