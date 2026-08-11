#Requires -Version 5.1
param([string]$ProjectRoot = ".")

$ErrorActionPreference = "Stop"
$trackersFile = Join-Path $ProjectRoot "src\config\defaultTrackers.ts"

if (-not (Test-Path $trackersFile)) {
    Write-Error "File not found: $trackersFile"
    exit 1
}

$dtContent = Get-Content $trackersFile -Raw
$fixed = $false

# ── 1. Add household to emojiMap (if missing) ───────────────────────────────
if ($dtContent -notmatch "household:\s*'🏠'") {
    $dtContent = $dtContent -replace "special_needs:\s*'♿',\s*custom:\s*'✨',", "special_needs: '♿',`r`n    household: '🏠',`r`n    custom: '✨',"
    Write-Host "Fixed: Added 'household' to emojiMap" -ForegroundColor Green
    $fixed = $true
} else {
    Write-Host "OK: emojiMap already contains household" -ForegroundColor Cyan
}

# ── 2. Insert 24 missing tracker configs into DEFAULT_TRACKERS (if missing) ─
if ($dtContent -notmatch "id:\s*'dream_feed'") {

    $newTrackers = @"
  // ── New Essential ──────────────────────────────────────────────
  {
    id: 'dream_feed', name: 'Dream Feed', emoji: '🌙', icon: 'moon-outline',
    color: '#5F27CD', gradient: ['#5F27CD', '#341F97'],
    description: 'Nighttime feed without fully waking baby',
    category: 'essential', isCustom: false, createdAt: 0, updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.datetime('time', 'Feed Time', { required: true }),
      f.select('type', 'Type', [
        { id: 'breast', label: 'Breast', emoji: '🤱' },
        { id: 'bottle', label: 'Bottle', emoji: '🍼' },
      ], { required: true }),
      f.quantity('amount', 'Amount', {
        showIf: { field: 'type', equals: 'bottle' },
        unitOptions: [
          { id: 'ml', label: 'ml' },
          { id: 'oz', label: 'oz' },
        ],
      }),
      f.toggle('woke', 'Baby woke fully?'),
      f.toggle('backToSleep', 'Went back to sleep easily?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Success', 'Woke up', 'Refused', 'Long sleep after'],
  },
  {
    id: 'burp', name: 'Burp', emoji: '💨', icon: 'cloud-outline',
    color: '#48DBFB', gradient: ['#48DBFB', '#0ABDE3'],
    description: 'Track spit-up and burping',
    category: 'essential', isCustom: false, createdAt: 0, updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select('result', 'Result', [
        { id: 'burp', label: 'Burped', emoji: '💨' },
        { id: 'spit_up', label: 'Spit Up', emoji: '🤮' },
        { id: 'none', label: 'No Burp', emoji: '❌' },
        { id: 'wet_burp', label: 'Wet Burp', emoji: '💧' },
      ], { required: true }),
      f.duration('timeToBurp', 'Time to Burp'),
      f.select('technique', 'Technique', [
        { id: 'over_shoulder', label: 'Over Shoulder', emoji: '👆' },
        { id: 'sitting', label: 'Sitting Up', emoji: '🪑' },
        { id: 'tummy', label: 'Across Tummy', emoji: '🤱' },
        { id: 'pat', label: 'Gentle Pat', emoji: '👋' },
        { id: 'rub', label: 'Back Rub', emoji: '💆' },
      ]),
      f.toggle('largeSpitUp', 'Large spit-up?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Easy burp', 'Spit up', 'Took forever', 'None'],
  },

  // ── Health ─────────────────────────────────────────────────
  {
    id: 'jaundice', name: 'Jaundice', emoji: '💛', icon: 'sunny-outline',
    color: '#FDCB6E', gradient: ['#FDCB6E', '#E17055'],
    description: 'Track bilirubin levels & symptoms',
    category: 'health', isCustom: false, createdAt: 0, updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.number('bilirubin', 'Bilirubin Level', { suffix: 'mg/dL' }),
      f.select('zone', 'Zone', [
        { id: 'low', label: 'Low Risk', emoji: '🟢' },
        { id: 'medium', label: 'Medium Risk', emoji: '🟡' },
        { id: 'high', label: 'High Risk', emoji: '🔴' },
      ]),
      f.select('type', 'Type', [
        { id: 'physiological', label: 'Physiological', emoji: '👶' },
        { id: 'breast_milk', label: 'Breast Milk', emoji: '🤱' },
        { id: 'hemolytic', label: 'Hemolytic', emoji: '🩸' },
      ]),
      f.toggle('phototherapy', 'Under phototherapy?'),
      f.toggle('feeding_well', 'Feeding well?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Improving', 'Worsening', 'Phototherapy', 'Doctor visit'],
  },
  {
    id: 'tongue_tie', name: 'Tongue Tie', emoji: '👅', icon: 'cut-outline',
    color: '#E84393', gradient: ['#E84393', '#FD79A8'],
    description: 'Tongue/lip tie assessment & revision tracking',
    category: 'health', isCustom: false, createdAt: 0, updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select('type', 'Type', [
        { id: 'anterior', label: 'Anterior', emoji: '🔺' },
        { id: 'posterior', label: 'Posterior', emoji: '🔻' },
        { id: 'lip', label: 'Lip Tie', emoji: '👄' },
        { id: 'buccal', label: 'Buccal', emoji: '😶' },
      ], { required: true }),
      f.select('severity', 'Severity', [
        { id: 'mild', label: 'Mild', emoji: '🟢' },
        { id: 'moderate', label: 'Moderate', emoji: '🟡' },
        { id: 'severe', label: 'Severe', emoji: '🔴' },
      ]),
      f.toggle('revision', 'Had revision?'),
      f.toggle('feeding_impact', 'Impacting feeding?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Revision done', 'Feeding better', 'Consult scheduled', 'Stretching'],
  },
  {
    id: 'dental_visit', name: 'Dental Visit', emoji: '🦷', icon: 'medical-outline',
    color: '#00CEC9', gradient: ['#00CEC9', '#00B894'],
    description: 'Pediatric dentist appointments',
    category: 'health', isCustom: false, createdAt: 0, updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.datetime('date', 'Visit Date', { required: true }),
      f.text('dentist', 'Dentist Name'),
      f.select('type', 'Visit Type', [
        { id: 'checkup', label: 'Checkup', emoji: '🔍' },
        { id: 'cleaning', label: 'Cleaning', emoji: '🪥' },
        { id: 'cavity', label: 'Cavity Fill', emoji: '🕳️' },
        { id: 'emergency', label: 'Emergency', emoji: '🚨' },
        { id: 'ortho', label: 'Orthodontic', emoji: '😁' },
      ]),
      f.toggle('cavities', 'Cavities found?'),
      f.toggle('fluoride', 'Fluoride treatment?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['No cavities!', 'Cavities found', 'Fluoride', 'Next appt set'],
  },
  {
    id: 'feeding_pain', name: 'Feeding Pain', emoji: '🤱', icon: 'warning-outline',
    color: '#E74C3C', gradient: ['#E74C3C', '#C0392B'],
    description: 'Breastfeeding pain and issues',
    category: 'health', isCustom: false, createdAt: 0, updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select('type', 'Pain Type', [
        { id: 'latch', label: 'Latch Pain', emoji: '👄' },
        { id: 'nipple', label: 'Nipple Damage', emoji: '🔴' },
        { id: 'engorgement', label: 'Engorgement', emoji: '🎈' },
        { id: 'mastitis', label: 'Mastitis Signs', emoji: '🌡️' },
        { id: 'duct', label: 'Clogged Duct', emoji: '⛔' },
        { id: 'thrush', label: 'Thrush', emoji: '👅' },
      ], { required: true }),
      f.select('side', 'Side', [
        { id: 'left', label: 'Left', emoji: '⬅️' },
        { id: 'right', label: 'Right', emoji: '➡️' },
        { id: 'both', label: 'Both', emoji: '↔️' },
      ]),
      f.rating('severity', 'Severity', 5),
      f.toggle('fed_anyway', 'Fed through pain?'),
      f.toggle('pump_instead', 'Pumped instead?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Improving', 'Worsening', 'Called LC', 'Medication helped'],
  },

  // ── Development ────────────────────────────────────────────
  {
    id: 'school', name: 'School', emoji: '🎒', icon: 'school-outline',
    color: '#6C5CE7', gradient: ['#6C5CE7', '#A29BFE'],
    description: 'School day, homework, and progress',
    category: 'development', isCustom: false, createdAt: 0, updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.text('subject', 'Subject/Activity', { required: true }),
      f.select('type', 'Type', [
        { id: 'homework', label: 'Homework', emoji: '📝' },
        { id: 'project', label: 'Project', emoji: '🎨' },
        { id: 'test', label: 'Test/Quiz', emoji: '📊' },
        { id: 'reading', label: 'Reading', emoji: '📚' },
        { id: 'extracurricular', label: 'Extracurricular', emoji: '🎭' },
      ]),
      f.rating('performance', 'Performance', 5),
      f.toggle('completed', 'Completed?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Great job!', 'Needs help', 'Completed', 'Struggling'],
  },
  {
    id: 'fine_motor', name: 'Fine Motor', emoji: '✋', icon: 'hand-left-outline',
    color: '#9B59B6', gradient: ['#9B59B6', '#8E44AD'],
    description: 'Fine motor skill milestones',
    category: 'development', isCustom: false, createdAt: 0, updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.multiselect('skill', 'Skill Observed', [
        { id: 'pincer', label: 'Pincer Grasp', emoji: '👌' },
        { id: 'scribble', label: 'Scribbling', emoji: '✏️' },
        { id: 'stack', label: 'Stacking Blocks', emoji: '🧱' },
        { id: 'turn_pages', label: 'Turns Pages', emoji: '📖' },
        { id: 'button', label: 'Buttons/Zippers', emoji: '👕' },
        { id: 'cut', label: 'Cutting with Scissors', emoji: '✂️' },
        { id: 'draw', label: 'Drawing Shapes', emoji: '🎨' },
        { id: 'write', label: 'Writing Letters', emoji: '✍️' },
      ], { required: true }),
      f.rating('proficiency', 'Proficiency', 5),
      f.toggle('dominant_hand', 'Dominant hand used?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['New skill!', 'Improving', 'Needs practice', 'Both hands'],
  },
  {
    id: 'gross_motor', name: 'Gross Motor', emoji: '🏃', icon: 'walk-outline',
    color: '#1DD1A1', gradient: ['#1DD1A1', '#10AC84'],
    description: 'Large movement milestones',
    category: 'development', isCustom: false, createdAt: 0, updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.multiselect('skill', 'Skill Observed', [
        { id: 'roll', label: 'Rolling Over', emoji: '🔄' },
        { id: 'sit', label: 'Sitting', emoji: '🪑' },
        { id: 'crawl', label: 'Crawling', emoji: '🐛' },
        { id: 'walk', label: 'Walking', emoji: '🚶' },
        { id: 'run', label: 'Running', emoji: '🏃' },
        { id: 'jump', label: 'Jumping', emoji: '⬆️' },
        { id: 'kick', label: 'Kicking', emoji: '⚽' },
        { id: 'climb', label: 'Climbing', emoji: '🧗' },
        { id: 'balance', label: 'Balance', emoji: '⚖️' },
      ], { required: true }),
      f.rating('confidence', 'Confidence', 5),
      f.toggle('assisted', 'Assisted?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['First time!', 'Unassisted', 'Falling', 'Confident'],
  },
  {
    id: 'pretend_play', name: 'Pretend Play', emoji: '🎭', icon: 'color-wand-outline',
    color: '#FF9FF3', gradient: ['#FF9FF3', '#F368E0'],
    description: 'Imaginative and pretend play',
    category: 'development', isCustom: false, createdAt: 0, updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.multiselect('activity', 'Activity', [
        { id: 'feed_doll', label: 'Feeding Doll', emoji: '🍼' },
        { id: 'phone', label: 'Talking on Phone', emoji: '📞' },
        { id: 'cook', label: 'Cooking/Pretend Food', emoji: '🍳' },
        { id: 'dress_up', label: 'Dress Up', emoji: '👗' },
        { id: 'house', label: 'Playing House', emoji: '🏠' },
        { id: 'animal', label: 'Pretending to be Animal', emoji: '🐕' },
        { id: 'superhero', label: 'Superhero/Character', emoji: '🦸' },
        { id: 'doctor', label: 'Playing Doctor', emoji: '👨‍⚕️' },
      ], { required: true }),
      f.rating('engagement', 'Engagement', 5),
      f.toggle('initiated', 'Self-initiated?'),
      f.toggle('storyline', 'Complex storyline?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Elaborate story', 'Solo play', 'With friends', 'New scenario'],
  },

  // ── Emotional ──────────────────────────────────────────────
  {
    id: 'tantrum', name: 'Tantrum', emoji: '😤', icon: 'flash-outline',
    color: '#E74C3C', gradient: ['#E74C3C', '#C0392B'],
    description: 'Track tantrum triggers & resolution',
    category: 'emotional', isCustom: false, createdAt: 0, updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select('trigger', 'Trigger', [
        { id: 'tired', label: 'Tired', emoji: '😴' },
        { id: 'hungry', label: 'Hungry', emoji: '🍽️' },
        { id: 'overstimulated', label: 'Overstimulated', emoji: '🌀' },
        { id: 'frustrated', label: 'Frustrated', emoji: '😤' },
        { id: 'transition', label: 'Transition', emoji: '🔄' },
        { id: 'denied', label: 'Denied Request', emoji: '🚫' },
        { id: 'pain', label: 'Pain/Discomfort', emoji: '🤕' },
      ], { required: true }),
      f.duration('duration', 'Duration'),
      f.select('resolution', 'Resolution', [
        { id: 'calmed', label: 'Self-calmed', emoji: '😌' },
        { id: 'distraction', label: 'Distraction', emoji: '🎯' },
        { id: 'comfort', label: 'Physical Comfort', emoji: '🤗' },
        { id: 'time_out', label: 'Time Out', emoji: '⏱️' },
        { id: 'escalated', label: 'Escalated', emoji: '📈' },
      ]),
      f.toggle('public', 'Happened in public?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Short', 'Long', 'Public', 'Resolved calmly'],
  },
  {
    id: 'time_out', name: 'Time Out', emoji: '⏱️', icon: 'timer-outline',
    color: '#E84393', gradient: ['#E84393', '#FD79A8'],
    description: 'Discipline and time-out tracking',
    category: 'emotional', isCustom: false, createdAt: 0, updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.text('behavior', 'Behavior', { required: true, placeholder: 'e.g., Hitting' }),
      f.duration('duration', 'Duration'),
      f.select('location', 'Location', [
        { id: 'chair', label: 'Time-out Chair', emoji: '🪑' },
        { id: 'step', label: 'Naughty Step', emoji: '📶' },
        { id: 'room', label: 'Room', emoji: '🚪' },
        { id: 'corner', label: 'Quiet Corner', emoji: '🧘' },
      ]),
      f.toggle('compliance', 'Stayed in place?'),
      f.toggle('apologized', 'Apologized after?'),
      f.toggle('discussed', 'Discussed behavior after?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Calm after', 'Escalated', 'Apologized', 'Repeated behavior'],
  },
  {
    id: 'sibling_interaction', name: 'Sibling Interaction', emoji: '👶', icon: 'people-outline',
    color: '#54A0FF', gradient: ['#54A0FF', '#00D2D3'],
    description: 'Sibling bonding and conflicts',
    category: 'emotional', isCustom: false, createdAt: 0, updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select('type', 'Interaction Type', [
        { id: 'sharing', label: 'Sharing', emoji: '🤝' },
        { id: 'conflict', label: 'Conflict', emoji: '⚡' },
        { id: 'bonding', label: 'Bonding', emoji: '❤️' },
        { id: 'helping', label: 'Helping', emoji: '🆘' },
        { id: 'playing', label: 'Playing Together', emoji: '🧸' },
        { id: 'teaching', label: 'Teaching', emoji: '📚' },
      ], { required: true }),
      f.text('sibling', 'Sibling Name/Age'),
      f.rating('positivity', 'Positivity', 5),
      f.toggle('intervention', 'Parent intervention needed?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Sweet moment', 'Resolved conflict', 'Needed help', 'Independent play'],
  },

  // ── Nutrition ──────────────────────────────────────────────
  {
    id: 'snack', name: 'Snack', emoji: '🍌', icon: 'cafe-outline',
    color: '#FF9F43', gradient: ['#FF9F43', '#FFD700'],
    description: 'Snack tracking',
    category: 'nutrition', isCustom: false, createdAt: 0, updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.text('food', 'Snack Item', { required: true, placeholder: 'e.g., Banana, Crackers' }),
      f.quantity('amount', 'Amount', {
        unitOptions: [
          { id: 'pieces', label: 'pieces' },
          { id: 'g', label: 'g' },
          { id: 'oz', label: 'oz' },
          { id: 'servings', label: 'servings' },
        ],
      }),
      f.select('type', 'Type', [
        { id: 'fruit', label: 'Fruit', emoji: '🍎' },
        { id: 'veg', label: 'Vegetable', emoji: '🥕' },
        { id: 'dairy', label: 'Dairy', emoji: '🧀' },
        { id: 'grain', label: 'Grain/Cracker', emoji: '🍞' },
        { id: 'protein', label: 'Protein', emoji: '🥜' },
        { id: 'treat', label: 'Treat', emoji: '🍪' },
      ]),
      f.toggle('requested', 'Self-requested?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Healthy', 'Refused', 'Requested', 'Grazing'],
  },
  {
    id: 'meal_plan', name: 'Meal Plan', emoji: '📋', icon: 'list-outline',
    color: '#FDCB6E', gradient: ['#FDCB6E', '#E17055'],
    description: 'Weekly menu and food planning',
    category: 'nutrition', isCustom: false, createdAt: 0, updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select('meal', 'Meal', [
        { id: 'breakfast', label: 'Breakfast', emoji: '🍳' },
        { id: 'lunch', label: 'Lunch', emoji: '🥪' },
        { id: 'dinner', label: 'Dinner', emoji: '🍽️' },
        { id: 'snack', label: 'Snack', emoji: '🍌' },
      ], { required: true }),
      f.text('menu', 'Planned Menu', { required: true, placeholder: 'e.g., Chicken, rice, broccoli' }),
      f.multiselect('newFoods', 'New Foods to Introduce', [
        { id: 'veg', label: 'Vegetable', emoji: '🥦' },
        { id: 'fruit', label: 'Fruit', emoji: '🍎' },
        { id: 'protein', label: 'Protein', emoji: '🍗' },
        { id: 'grain', label: 'Grain', emoji: '🍚' },
        { id: 'dairy', label: 'Dairy', emoji: '🥛' },
      ]),
      f.multiselect('rejected', 'Recently Rejected Foods', [
        { id: 'veg', label: 'Vegetable', emoji: '🥦' },
        { id: 'fruit', label: 'Fruit', emoji: '🍎' },
        { id: 'protein', label: 'Protein', emoji: '🍗' },
        { id: 'grain', label: 'Grain', emoji: '🍚' },
        { id: 'dairy', label: 'Dairy', emoji: '🥛' },
      ]),
      f.toggle('balanced', 'Balanced meal?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['New food day', 'Balanced', 'Picky eater', 'Prep ahead'],
  },
  {
    id: 'bottle_weaning', name: 'Bottle Weaning', emoji: '🥤', icon: 'beaker-outline',
    color: '#74B9FF', gradient: ['#74B9FF', '#0984E3'],
    description: 'Transition from bottle to cup',
    category: 'nutrition', isCustom: false, createdAt: 0, updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select('vessel', 'Vessel Used', [
        { id: 'bottle', label: 'Bottle', emoji: '🍼' },
        { id: 'sippy', label: 'Sippy Cup', emoji: '🥤' },
        { id: 'straw', label: 'Straw Cup', emoji: '🧃' },
        { id: 'open', label: 'Open Cup', emoji: '🥛' },
        { id: '360', label: '360 Cup', emoji: '🔵' },
      ], { required: true }),
      f.select('liquid', 'Liquid', [
        { id: 'milk', label: 'Milk', emoji: '🥛' },
        { id: 'formula', label: 'Formula', emoji: '🍼' },
        { id: 'water', label: 'Water', emoji: '💧' },
        { id: 'juice', label: 'Juice', emoji: '🧃' },
      ]),
      f.quantity('amount', 'Amount', {
        unitOptions: [
          { id: 'ml', label: 'ml' },
          { id: 'oz', label: 'oz' },
        ],
      }),
      f.toggle('spill', 'Any spills?'),
      f.toggle('independent', 'Held independently?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['No spills!', 'Spilled', 'Refused cup', 'Progress'],
  },

  // ── Safety ─────────────────────────────────────────────────
  {
    id: 'swim_lessons', name: 'Swim Lessons', emoji: '🏊', icon: 'water-outline',
    color: '#00CEC9', gradient: ['#00CEC9', '#00B894'],
    description: 'Pool safety and swim skills',
    category: 'safety', isCustom: false, createdAt: 0, updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select('skill', 'Skill Focus', [
        { id: 'water_comfort', label: 'Water Comfort', emoji: '💧' },
        { id: 'floating', label: 'Floating', emoji: '🛟' },
        { id: 'kicking', label: 'Kicking', emoji: '🦵' },
        { id: 'arm_move', label: 'Arm Movements', emoji: '💪' },
        { id: 'breath', label: 'Breath Control', emoji: '🫁' },
        { id: 'submerge', label: 'Submerging', emoji: '🤿' },
        { id: 'stroke', label: 'Basic Stroke', emoji: '🏊' },
      ], { required: true }),
      f.rating('comfort', 'Comfort Level', 5),
      f.toggle('floaties', 'Used floaties/vest?'),
      f.toggle('instructor', 'With instructor?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Loved water', 'Cried', 'New skill', 'Floats alone'],
  },
  {
    id: 'fire_drill', name: 'Fire Drill', emoji: '🔥', icon: 'flame-outline',
    color: '#D63031', gradient: ['#D63031', '#E17055'],
    description: 'Home safety drills',
    category: 'safety', isCustom: false, createdAt: 0, updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select('type', 'Drill Type', [
        { id: 'fire', label: 'Fire Drill', emoji: '🔥' },
        { id: 'earthquake', label: 'Earthquake', emoji: '🌋' },
        { id: 'tornado', label: 'Tornado', emoji: '🌪️' },
        { id: 'lockdown', label: 'Lockdown', emoji: '🔒' },
      ], { required: true }),
      f.duration('timeToExit', 'Time to Safe Spot'),
      f.toggle('meeting_spot', 'Met at meeting spot?'),
      f.toggle('stay_low', 'Remembered stay low?'),
      f.toggle('dont_open', 'Did not open hot door?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Fast exit', 'Needed reminders', 'Practiced', 'First drill'],
  },

  // ── Parental ───────────────────────────────────────────────
  {
    id: 'postpartum_recovery', name: 'Postpartum Recovery', emoji: '💜', icon: 'medical-outline',
    color: '#9B59B6', gradient: ['#9B59B6', '#8E44AD'],
    description: 'Mom recovery tracking',
    category: 'parental', isCustom: false, createdAt: 0, updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select('symptom', 'Symptom/Check', [
        { id: 'bleeding', label: 'Bleeding/Lochia', emoji: '🔴' },
        { id: 'pain', label: 'Pain/Cramps', emoji: '😣' },
        { id: 'mood', label: 'Mood Check', emoji: '😊' },
        { id: 'sleep', label: 'Sleep Quality', emoji: '😴' },
        { id: 'appetite', label: 'Appetite', emoji: '🍽️' },
        { id: 'incision', label: 'Incision/C-section', emoji: '✂️' },
        { id: 'breast', label: 'Breast Pain', emoji: '🤱' },
      ], { required: true }),
      f.rating('severity', 'Severity/Intensity', 5),
      f.toggle('medication', 'Took medication?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Improving', 'Concerning', 'Call doctor', 'Normal'],
  },

  // ── Special Needs ──────────────────────────────────────────
  {
    id: 'therapy', name: 'Therapy', emoji: '🧩', icon: 'accessibility-outline',
    color: '#A29BFE', gradient: ['#A29BFE', '#6C5CE7'],
    description: 'PT, OT, ST, and other therapy sessions',
    category: 'special_needs', isCustom: false, createdAt: 0, updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select('type', 'Therapy Type', [
        { id: 'pt', label: 'Physical Therapy', emoji: '💪' },
        { id: 'ot', label: 'Occupational Therapy', emoji: '✋' },
        { id: 'st', label: 'Speech Therapy', emoji: '🗣️' },
        { id: 'aba', label: 'ABA', emoji: '🧩' },
        { id: 'feeding', label: 'Feeding Therapy', emoji: '🥄' },
        { id: 'play', label: 'Play Therapy', emoji: '🧸' },
      ], { required: true }),
      f.text('therapist', 'Therapist Name'),
      f.rating('engagement', 'Engagement', 5),
      f.toggle('homework', 'Homework assigned?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Great session', 'Struggled', 'New goal', 'Homework'],
  },

  // ── Household ──────────────────────────────────────────────
  {
    id: 'supply_inventory', name: 'Supply Inventory', emoji: '📦', icon: 'cube-outline',
    color: '#8E44AD', gradient: ['#8E44AD', '#9B59B6'],
    description: 'Track diaper, wipe, formula stock levels',
    category: 'household', isCustom: false, createdAt: 0, updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select('item', 'Item', [
        { id: 'diapers', label: 'Diapers', emoji: '👶' },
        { id: 'wipes', label: 'Wipes', emoji: '🧻' },
        { id: 'formula', label: 'Formula', emoji: '🍼' },
        { id: 'diaper_cream', label: 'Diaper Cream', emoji: '🧴' },
        { id: 'lotion', label: 'Lotion', emoji: '🫧' },
        { id: 'shampoo', label: 'Shampoo', emoji: '🧼' },
        { id: 'medicine', label: 'Medicine', emoji: '💊' },
        { id: 'pacifiers', label: 'Pacifiers', emoji: '😶' },
      ], { required: true }),
      f.select('status', 'Stock Status', [
        { id: 'full', label: 'Full', emoji: '🟢' },
        { id: 'half', label: 'Half', emoji: '🟡' },
        { id: 'low', label: 'Low', emoji: '🔴' },
        { id: 'out', label: 'Out', emoji: '⚫' },
      ]),
      f.number('quantity', 'Quantity Remaining'),
      f.toggle('reorder', 'Need to reorder?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Stocked up', 'Running low', 'Ordered', 'Out of stock'],
  },
  {
    id: 'pumping_inventory', name: 'Pumping Inventory', emoji: '🥛', icon: 'flask-outline',
    color: '#74B9FF', gradient: ['#74B9FF', '#0984E3'],
    description: 'Track pumped milk stash',
    category: 'household', isCustom: false, createdAt: 0, updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.datetime('pumped', 'Pumped At', { required: true }),
      f.quantity('amount', 'Amount', {
        required: true,
        unitOptions: [
          { id: 'ml', label: 'ml' },
          { id: 'oz', label: 'oz' },
        ],
      }),
      f.select('storage', 'Storage', [
        { id: 'fridge', label: 'Fridge', emoji: '🧊' },
        { id: 'freezer', label: 'Freezer', emoji: '❄️' },
        { id: 'deep_freeze', label: 'Deep Freeze', emoji: '🧊' },
      ]),
      f.datetime('expires', 'Use By'),
      f.toggle('used', 'Already used?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Fresh pump', 'Freezer stash', 'Used', 'Expired'],
  },
  {
    id: 'expenses', name: 'Expenses', emoji: '💰', icon: 'cash-outline',
    color: '#F39C12', gradient: ['#F39C12', '#E67E22'],
    description: 'Baby-related spending tracker',
    category: 'household', isCustom: false, createdAt: 0, updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.text('item', 'Item/Service', { required: true, placeholder: 'e.g., Diapers' }),
      f.number('cost', 'Cost', { prefix: '$', required: true }),
      f.select('category', 'Category', [
        { id: 'diapers', label: 'Diapers', emoji: '👶' },
        { id: 'formula', label: 'Formula/Food', emoji: '🍼' },
        { id: 'clothing', label: 'Clothing', emoji: '👕' },
        { id: 'gear', label: 'Gear/Equipment', emoji: '🛒' },
        { id: 'medical', label: 'Medical', emoji: '🏥' },
        { id: 'toys', label: 'Toys/Books', emoji: '🧸' },
        { id: 'childcare', label: 'Childcare', emoji: '👩‍🏫' },
        { id: 'other', label: 'Other', emoji: '📦' },
      ]),
      f.toggle('essential', 'Essential purchase?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Essential', 'Splurge', 'Sale', 'Subscription'],
  },
  {
    id: 'cleaning', name: 'Cleaning', emoji: '🧼', icon: 'sparkles-outline',
    color: '#00B894', gradient: ['#00B894', '#00CEC9'],
    description: 'Bottle, pump, and toy cleaning',
    category: 'household', isCustom: false, createdAt: 0, updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select('item', 'Item Cleaned', [
        { id: 'bottles', label: 'Bottles', emoji: '🍼' },
        { id: 'pump_parts', label: 'Pump Parts', emoji: '🤱' },
        { id: 'pacifiers', label: 'Pacifiers', emoji: '😶' },
        { id: 'toys', label: 'Toys', emoji: '🧸' },
        { id: 'high_chair', label: 'High Chair', emoji: '🪑' },
        { id: 'clothes', label: 'Clothes', emoji: '👕' },
        { id: 'sheets', label: 'Sheets', emoji: '🛏️' },
      ], { required: true }),
      f.select('method', 'Method', [
        { id: 'wash', label: 'Hand Wash', emoji: '🧼' },
        { id: 'dishwasher', label: 'Dishwasher', emoji: '🍽️' },
        { id: 'sterilize', label: 'Sterilized', emoji: '♨️' },
        { id: 'wipe', label: 'Wiped Down', emoji: '🧻' },
      ]),
      f.toggle('complete', 'Complete?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Sterilized', 'Deep clean', 'Daily wash', 'Behind schedule'],
  },
"@

    $find = @"
  },
];

export const DEFAULT_TRACKER_IDS
"@

    $replace = @"
  },
},
$newTrackers
];

export const DEFAULT_TRACKER_IDS
"@

    if ($dtContent.Contains($find)) {
        $dtContent = $dtContent.Replace($find, $replace)
        Write-Host "Fixed: Inserted 24 tracker configs into DEFAULT_TRACKERS" -ForegroundColor Green
        $fixed = $true
    } else {
        Write-Error "Could not find the DEFAULT_TRACKERS insertion point. Manual fix required."
        exit 1
    }
} else {
    Write-Host "OK: Tracker configs already present" -ForegroundColor Cyan
}

Set-Content $trackersFile $dtContent -NoNewline

if ($fixed) {
    Write-Host "`nDone. Next steps:" -ForegroundColor Cyan
    Write-Host "  1. npx tsc --noEmit" -ForegroundColor White
    Write-Host "  2. npx expo start --clear" -ForegroundColor White
} else {
    Write-Host "`nNothing needed fixing." -ForegroundColor Cyan
}