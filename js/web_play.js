import './zarbans_grotto.js';

const player = new Zarban.Player();

globalThis.advanceGame = (option) => {
    if (option) player.nextStory(option);

    let text = [ `<h4>${player.currentChapter.name}</h4>` ]
    let playerStats = player.getAdjustedStats();
    text = text.concat(playerStats.currentStory.text);
    text.push('<br />');
    for (const status of playerStats.status.list_visible()) {
        let statusValue = playerStats.status.get(status);
        text.push(`${status}: ${statusValue.value}/${statusValue.maximum}`);
    }
    text.push('<br />Equipment:');
    for (const item of playerStats.inventory.all_equipped()) {
        text.push(`- ${item.description}`);
    }

    document.getElementById('zarban_gameboard').innerHTML = text.map(l => `<p>${l}</p>`).join('\n');

    let options = playerStats.currentStory.options.filter(o => playerStats.validateConditions(o.conditions));     
    const buttons = options.map((o,i) => `<button onClick="advanceGame(${i+1})">> ${o}</button>`);
    document.getElementById('zarban_buttons').innerHTML = buttons.join('\n<br/>');
}

advanceGame();