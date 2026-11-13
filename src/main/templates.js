/**
 * StickyPad Note Templates Configuration.
 * Edit, add, or customize templates here anytime.
 */
module.exports = [
  {
    id: 'blank',
    title: 'Blank note',
    icon: '📝',
    color: 'yellow',
    paperStyle: 'classic',
    content: ''
  },
  {
    id: 'shopping',
    title: 'Shopping list',
    icon: '🛒',
    color: 'green',
    paperStyle: 'classic',
    content: '<div><b>🛒 Shopping List</b></div><div class="checklist-item" data-checked="false"><span class="checkbox-custom" contenteditable="false"></span><span class="checklist-text" contenteditable="true">Produce &amp; Vegetables</span></div><div class="checklist-item" data-checked="false"><span class="checkbox-custom" contenteditable="false"></span><span class="checklist-text" contenteditable="true">Milk &amp; Dairy</span></div><div class="checklist-item" data-checked="false"><span class="checkbox-custom" contenteditable="false"></span><span class="checklist-text" contenteditable="true">Bakery &amp; Bread</span></div><div class="checklist-item" data-checked="false"><span class="checkbox-custom" contenteditable="false"></span><span class="checklist-text" contenteditable="true">Coffee &amp; Snacks</span></div>'
  },
  {
    id: 'daily-todo',
    title: 'Daily to-do',
    icon: '✅',
    color: 'peach',
    paperStyle: 'corner-curl',
    content: '<div><b>📅 Daily To-Do</b></div><div class="checklist-item" data-checked="false"><span class="checkbox-custom" contenteditable="false"></span><span class="checklist-text" contenteditable="true">Top priority task for today</span></div><div class="checklist-item" data-checked="false"><span class="checkbox-custom" contenteditable="false"></span><span class="checklist-text" contenteditable="true">Respond to key messages</span></div><div class="checklist-item" data-checked="false"><span class="checkbox-custom" contenteditable="false"></span><span class="checklist-text" contenteditable="true">30-minute deep work session</span></div><div class="checklist-item" data-checked="false"><span class="checkbox-custom" contenteditable="false"></span><span class="checklist-text" contenteditable="true">Wrap-up &amp; plan tomorrow</span></div>'
  },
  {
    id: 'study-plan',
    title: 'Study plan',
    icon: '📚',
    color: 'blue',
    paperStyle: 'bent-edge',
    content: '<div><b>📚 Study Plan</b></div><div><b>Goal:</b> Topic Mastery</div><div class="checklist-item" data-checked="false"><span class="checkbox-custom" contenteditable="false"></span><span class="checklist-text" contenteditable="true">Read core chapter / lecture</span></div><div class="checklist-item" data-checked="false"><span class="checkbox-custom" contenteditable="false"></span><span class="checklist-text" contenteditable="true">Solve 5 practice problems</span></div><div class="checklist-item" data-checked="false"><span class="checkbox-custom" contenteditable="false"></span><span class="checklist-text" contenteditable="true">Flashcards &amp; spaced repetition</span></div><div><b>Summary Notes:</b></div><div>• Key formula or concept</div>'
  },
  {
    id: 'meeting-notes',
    title: 'Meeting notes',
    icon: '👥',
    color: 'purple',
    paperStyle: 'taped',
    content: '<div><b>👥 Meeting Notes</b></div><div><b>Topic:</b> Project Sync</div><div><b>Attendees:</b> Team</div><div><b>Key Decisions:</b></div><div>• Approved timeline and next sprint goals</div><div><b>Action Items:</b></div><div class="checklist-item" data-checked="false"><span class="checkbox-custom" contenteditable="false"></span><span class="checklist-text" contenteditable="true">Draft requirements document</span></div><div class="checklist-item" data-checked="false"><span class="checkbox-custom" contenteditable="false"></span><span class="checklist-text" contenteditable="true">Share meeting recording &amp; notes</span></div>'
  }
];
