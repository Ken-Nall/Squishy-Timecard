// ==UserScript==
// @name         Squishy Timecard
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Collapse direct time entries on timecard into summarized clusters
// @author       Ken Nall @kennenal (MDW7) 
// @match        https://fclm-portal.amazon.com/employee/timeDetails*
// @match        https://fclm-portal.amazon.com/employee/ppaTimeDetails*
// @grant        none
// @downloadURL   https://tamarin.aces.amazon.dev/scripts/squishy-timecard/install.user.js
// @updateURL     https://tamarin.aces.amazon.dev/scripts/squishy-timecard/install.user.js
// ==/UserScript==

(function() {
    'use strict';

    function parseTime(timeStr) {
        const [mins, secs] = timeStr.split(':').map(Number);
        return mins * 60 + secs;
    }

    function formatTime(totalSeconds) {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    let viewLengthSeconds = 0;

    function parseViewPeriod() {
        const foldSummary = document.querySelector('tr.fold-summary');
        console.log('foldSummary element:', foldSummary);
        if (!foldSummary) {
            console.warn('No fold-summary element found');
            return;
        }

        const text = foldSummary.textContent;
        console.log('fold-summary text:', text);
        
        // Try to match single day format: "Day YYYY/MM/DD"
        const singleDayMatch = text.match(/Day\s+(\d{4})\/(\d{2})\/(\d{2})/);
        if (singleDayMatch) {
            const [, year, month, day] = singleDayMatch.map(Number);
            console.log(`Parsed single day - ${year}/${month}/${day}`);
            viewLengthSeconds = 24 * 60 * 60; // 86400 seconds
            console.log('viewLengthSeconds:', viewLengthSeconds);
            return;
        }
        
        // Try to match date-time range format
        const dateTimeMatch = text.match(/(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})\s*-\s*(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/);
        console.log('dateTimeMatch result:', dateTimeMatch);
        
        if (dateTimeMatch) {
            const [, startYear, startMonth, startDay, startHour, startMin, endYear, endMonth, endDay, endHour, endMin] = dateTimeMatch.map(Number);
            console.log(`Parsed dates - Start: ${startYear}/${startMonth}/${startDay} ${startHour}:${startMin}, End: ${endYear}/${endMonth}/${endDay} ${endHour}:${endMin}`);
            
            const startDate = new Date(startYear, startMonth - 1, startDay, startHour, startMin);
            const endDate = new Date(endYear, endMonth - 1, endDay, endHour, endMin);
            console.log('startDate:', startDate, 'endDate:', endDate);
            
            viewLengthSeconds = (endDate.getTime() - startDate.getTime()) / 1000;
            console.log('viewLengthSeconds:', viewLengthSeconds);
        } else {
            console.warn('No date-time pattern match found');
        }
    }

    parseViewPeriod();

    function calculateWidth(totalSeconds) {
        // Based on ratio: 33m22s (2002 seconds) = 2.3287037037037037%
        const referenceSeconds = 2002;
        const referenceWidth = 2.3287037037037037;
        return (totalSeconds / referenceSeconds) * referenceWidth * (86400 / viewLengthSeconds);
    }

    function collapseDirectTime() {
        const rows = document.querySelectorAll('tr.function-seg.direct');
        if (rows.length === 0) return;

        let clusters = [];
        let currentCluster = [];

        rows.forEach((row, index) => {
            if (currentCluster.length === 0) {
                currentCluster.push(row);
            } else {
                const prevRow = currentCluster[currentCluster.length - 1];
                const prevNext = prevRow.nextElementSibling;
                
                if (prevNext === row) {
                    currentCluster.push(row);
                } else {
                    clusters.push(currentCluster);
                    currentCluster = [row];
                }
            }
        });
        
        if (currentCluster.length > 0) {
            clusters.push(currentCluster);
        }

        clusters.forEach(cluster => {
            if (cluster.length <= 1) return;

            const firstRow = cluster[0];
            const lastRow = cluster[cluster.length - 1];

            const titles = new Set();
            let totalSeconds = 0;

            cluster.forEach(row => {
                const titleCell = row.querySelector('td[colspan="2"]');
                if (titleCell) {
                    titles.add(titleCell.textContent.trim());
                }
                const timeCell = row.querySelector('td.rightAlign');
                if (timeCell) {
                    totalSeconds += parseTime(timeCell.textContent.trim());
                }
            });

            const firstRowCells = firstRow.querySelectorAll('td');
            const lastRowCells = lastRow.querySelectorAll('td');
            const startTime = firstRowCells[1].textContent.trim();
            const endTime = lastRowCells[2].textContent.trim();
            const formattedTime = formatTime(totalSeconds);
            const newWidth = calculateWidth(totalSeconds);

            console.log('Collapsing cluster with', cluster.length, 'rows, total seconds:', totalSeconds, 'new width:', newWidth);

            const titleCell = firstRow.querySelector('td[colspan="2"]');
            const titleArray = Array.from(titles);
            titleCell.textContent = titleArray[0];
            titleCell.title = titleArray.join('\n');
            titleCell.style.cursor = 'help';
            firstRowCells[1].textContent = startTime;
            firstRowCells[2].textContent = endTime;
            firstRow.querySelector('td.rightAlign').textContent = formattedTime;
            
            // Adjust the time-segment width
            const timeSegment = firstRow.querySelector('.time-segment');
            console.log('Time segment element:', timeSegment);
            if (timeSegment) {
                timeSegment.style.setProperty('width', `${newWidth}%`, 'important');
                console.log('Applied width:', newWidth + '%');
            } else {
                console.warn('No .time-segment element found in row');
            }

            for (let i = 1; i < cluster.length; i++) {
                cluster[i].remove();
            }
        });
    }

    collapseDirectTime();
})();