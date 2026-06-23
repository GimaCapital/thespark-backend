const admin = require('firebase-admin');
const dotenv = require('dotenv');
dotenv.config();

// Use environment variables (matching your server.js pattern)
const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
};

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const messages = [
    // In Firestore 'dailyMessages' collection:
    { cycle: 0, day: 0, principle: "👋 Welcome to TheSpark!", message: "Welcome to TheSpark! You've taken the first step toward financial freedom.\n\nHere's how it works:\n💰 Save daily (even ₦100 counts!)\n📈 Earn interest every 21-day cycle\n🎓 Graduate in 6 months with real wealth skills\n\nReady to begin? Make your first deposit to start Day 1 of your wealth journey! 🚀"},
    // Cycle 1: Pay Yourself First (Days 1-22)
    { cycle: 1, day: 1, principle: "Pay yourself first", message: "Welcome to TheSpark. The first principle of wealth: 'A part of all you earn is yours to keep.' Today, save your first amount. This is yours. No one will take it. Be the spark." },
    { cycle: 1, day: 2, principle: "Pay yourself first", message: "Before you pay anyone else — the landlord, the trader, the tailor — pay yourself first. Save today's money. You are now your own first creditor. Be the spark." },
    { cycle: 1, day: 3, principle: "Pay yourself first", message: "How much did you save yesterday? Today, save again. Small drops of water make a mighty ocean. Poverty ends with small, daily discipline. Be the spark." },
    { cycle: 1, day: 4, principle: "Pay yourself first", message: "The rich did not become rich overnight. They saved 10% of everything. What is 10% of what you earned today? Save it. Be the spark." },
    { cycle: 1, day: 5, principle: "Pay yourself first", message: "If you cannot save ₦500, save ₦100. If you cannot save ₦100, save ₦50. The amount does not matter. The habit matters. Be the spark." },
    { cycle: 1, day: 6, principle: "Pay yourself first", message: "Ask yourself: 'Where did my money go yesterday?' Most people cannot answer. Track your spending. Then save first. Be the spark." },
    { cycle: 1, day: 7, principle: "Pay yourself first", message: "One week done. Look at your balance. That money belongs to FUTURE YOU. Do not touch it unless emergency. Be the spark." },
    { cycle: 1, day: 8, principle: "Pay yourself first", message: "'Wealth is not what you earn. Wealth is what you keep.' You are keeping money. You are becoming wealthy. Be the spark." },
    { cycle: 1, day: 9, principle: "Pay yourself first", message: "Some will laugh at you for saving small amounts. Let them laugh. In one year, you will have money. They will have nothing. Be the spark." },
    { cycle: 1, day: 10, principle: "Pay yourself first", message: "Every day you save, you buy freedom. Freedom from borrowing. Freedom from emergency distress. Freedom from poverty. Be the spark." },
    { cycle: 1, day: 11, principle: "Pay yourself first", message: "The poor spend first and save what remains. The rich save first and spend what remains. Which one are you becoming? Be the spark." },
    { cycle: 1, day: 12, principle: "Pay yourself first", message: "Today, save twice. Morning and evening. Prove to yourself that you can. Be the spark." },
    { cycle: 1, day: 13, principle: "Pay yourself first", message: "You have saved for 12 days. Most Nigerians have never saved for 12 days straight. You are already different. Be the spark." },
    { cycle: 1, day: 14, principle: "Pay yourself first", message: "Two weeks. Your balance is growing. This is not magic. This is discipline. Wealth loves discipline. Be the spark." },
    { cycle: 1, day: 15, principle: "Pay yourself first", message: "When you want to withdraw, ask: 'Is this an emergency or just a desire?' If it is desire, wait. Let your money grow. Be the spark." },
    { cycle: 1, day: 16, principle: "Pay yourself first", message: "Teach one person today what you are learning. Say: 'I am saving with TheSpark. You can too.' Teaching reinforces learning. Be the spark." },
    { cycle: 1, day: 17, principle: "Pay yourself first", message: "Seventeen days. You are close to your first interest payment. Stay strong. Be the spark." },
    { cycle: 1, day: 18, principle: "Pay yourself first", message: "Remember: Deposits in the last 5 days of this cycle will not earn interest. Plan your savings earlier in the cycle. Be the spark." },
    { cycle: 1, day: 19, principle: "Pay yourself first", message: "Three days left in this cycle. Do not stop. The finish line is near. Be the spark." },
    { cycle: 1, day: 20, principle: "Pay yourself first", message: "Tomorrow is your last deposit day for this cycle. After tomorrow, any new deposit waits for next cycle. Be the spark." },
    { cycle: 1, day: 21, principle: "Pay yourself first", message: "Congratulations! You completed 21 days of saving. Tomorrow, you receive your first interest payment. Your money worked for you while you slept. Be the spark." },
    { cycle: 1, day: 22, principle: "Pay yourself first", message: "Here is your interest. This is free money. Your savings earned it. Keep it in your account to earn more interest next cycle. Be the spark." },
    
    // Cycle 2: Make Your Money Work (Days 23-43)
    { cycle: 2, day: 23, principle: "Make your money work", message: "New cycle. New lesson: 'Money is a slave. You must make it work.' Your interest last cycle was money working for you. Now let it work again. Be the spark." },
    { cycle: 2, day: 24, principle: "Make your money work", message: "The rich do not work for money. They send their money to work. Your money is now a worker. Every 21 days, it brings home interest. Be the spark." },
    { cycle: 2, day: 25, principle: "Make your money work", message: "If you had ₦100,000 and earned 5% every 21 days, in one year you would have ~₦400,000 without working. That is the power of money working. Be the spark." },
    { cycle: 2, day: 26, principle: "Make your money work", message: "Do not withdraw your interest. Reinvest it. Let it join your principal to earn more interest. This is compound growth. Be the spark." },
    { cycle: 2, day: 27, principle: "Make your money work", message: "Compound interest is the eighth wonder of the world. Those who understand it, earn it. Those who don't, pay it. Be the spark." },
    { cycle: 2, day: 28, principle: "Make your money work", message: "Your small daily savings + compound interest = wealth over time. The formula is simple. Only patience is required. Be the spark." },
    { cycle: 2, day: 29, principle: "Make your money work", message: "Two weeks ago, your balance was small. Look at it now. This is what happens when money works. Be the spark." },
    { cycle: 2, day: 30, principle: "Make your money work", message: "The poor keep money under the mattress. It sleeps. It does not work. Your money is awake and working every 21 days. Be the spark." },
    { cycle: 2, day: 31, principle: "Make your money work", message: "Every time you are tempted to withdraw, remember: That money is your employee. Do not fire your employee unless absolutely necessary. Be the spark." },
    { cycle: 2, day: 32, principle: "Make your money work", message: "In Babylon, the richest man said: 'Gold works diligently for its owner.' Your gold (money) is working for you right now. Be the spark." },
    { cycle: 2, day: 33, principle: "Make your money work", message: "Let me show you something: ₦10,000 at 5% per 21 days becomes ₦15,000 in 6 months. ₦10,000 under your bed becomes ₦10,000 forever. Which do you prefer? Be the spark." },
    { cycle: 2, day: 34, principle: "Make your money work", message: "Your money is like a farm. If you leave it, it grows. If you dig it up every day, it dies. Let your money grow. Be the spark." },
    { cycle: 2, day: 35, principle: "Make your money work", message: "The rich man's money works 24 hours a day, 7 days a week. It never sleeps. It never tires. It just grows. Be the spark." },
    { cycle: 2, day: 36, principle: "Make your money work", message: "Today, calculate: How much interest will you earn this cycle? Write that number down. That is your money's salary. Be the spark." },
    { cycle: 2, day: 37, principle: "Make your money work", message: "If you save ₦500 daily for one year: ₦182,500 savings + ~₦90,000 interest = ₦272,500. That is real money. Be the spark." },
    { cycle: 2, day: 38, principle: "Make your money work", message: "Your money does not care if you are rich or poor. It works the same for everyone. That is why saving is the great equalizer. Be the spark." },
    { cycle: 2, day: 39, principle: "Make your money work", message: "Some people work 10 hours a day for ₦5,000. Your money works 24 hours a day for free. Treat your money with respect. Be the spark." },
    { cycle: 2, day: 40, principle: "Make your money work", message: "Imagine having ₦1,000,000 earning 5% every 21 days. That is ₦50,000 every 3 weeks for doing nothing. That is freedom. Be the spark." },
    { cycle: 2, day: 41, principle: "Make your money work", message: "You may not have ₦1,000,000 today. But if you keep saving, one day you will. And your money will work for you. Be the spark." },
    { cycle: 2, day: 42, principle: "Make your money work", message: "Tomorrow is your last deposit day for this cycle. Make it count. Be the spark." },
    { cycle: 2, day: 43, principle: "Make your money work", message: "Cycle 2 complete! Your interest is ready. Your money worked again. This is not luck. This is a system. Be the spark." },
    
    // Cycle 3: Guard Your Wealth From Loss (Days 44-64)
    { cycle: 3, day: 44, principle: "Guard your wealth from loss", message: "New cycle. New lesson: 'Guard your wealth from loss.' It is not enough to earn money. You must keep it. Be the spark." },
    { cycle: 3, day: 45, principle: "Guard your wealth from loss", message: "In Babylon, many men lost their gold because they trusted the wrong people. Do not give your money to anyone who promises 'quick double.' Be the spark." },
    { cycle: 3, day: 46, principle: "Guard your wealth from loss", message: "If someone says 'give me ₦10,000, I will give you ₦20,000 next week' — run. That is a scam. Real wealth grows slowly. Be the spark." },
    { cycle: 3, day: 47, principle: "Guard your wealth from loss", message: "Before you invest in anything, ask: 'Who is holding my money? What have they done before? Can I trust them?' Be the spark." },
    { cycle: 3, day: 48, principle: "Guard your wealth from loss", message: "The safest place for your money is not always the bank. It is in YOUR control. Understand where your money goes. Be the spark." },
    { cycle: 3, day: 49, principle: "Guard your wealth from loss", message: "Do not lend money to friends unless you are ready to lose both the money and the friend. Be careful. Be the spark." },
    { cycle: 3, day: 50, principle: "Guard your wealth from loss", message: "Scammers target desperate people. Do not be desperate. Your daily savings protect you from desperation. Be the spark." },
    { cycle: 3, day: 51, principle: "Guard your wealth from loss", message: "If an opportunity sounds too good to be true, it is a lie. Real investments return 10-30% per year, not per week. Be the spark." },
    { cycle: 3, day: 52, principle: "Guard your wealth from loss", message: "Your wealth is like a child. You must protect it from those who would harm it. Guard it carefully. Be the spark." },
    { cycle: 3, day: 53, principle: "Guard your wealth from loss", message: "Never put all your money in one place. Spread it. If one fails, others survive. Be the spark." },
    { cycle: 3, day: 54, principle: "Guard your wealth from loss", message: "In Nigeria, many have lost savings to 'wonder banks.' If it is not registered with CBN, be very careful. Be the spark." },
    { cycle: 3, day: 55, principle: "Guard your wealth from loss", message: "Before you invest, consult wise people. Ask someone who has lost money before. Learn from their pain. Be the spark." },
    { cycle: 3, day: 56, principle: "Guard your wealth from loss", message: "The rich man said: 'Better a small return with safety than a large return with risk.' Slow and safe wins. Be the spark." },
    { cycle: 3, day: 57, principle: "Guard your wealth from loss", message: "Do not be ashamed to ask questions. 'How does this work? Who else has benefited? Can I see proof?' Be the spark." },
    { cycle: 3, day: 58, principle: "Guard your wealth from loss", message: "If someone pressures you to 'decide now or lose the opportunity' — walk away. Real opportunities wait. Be the spark." },
    { cycle: 3, day: 59, principle: "Guard your wealth from loss", message: "Your savings with TheSpark are safe because you can withdraw anytime. That is your protection. Be the spark." },
    { cycle: 3, day: 60, principle: "Guard your wealth from loss", message: "Do not follow crowd. Just because everyone is investing does not mean it is safe. Many crowds have walked off cliffs. Be the spark." },
    { cycle: 3, day: 61, principle: "Guard your wealth from loss", message: "Guard your wallet like a lion guards its cubs. Be suspicious. Be careful. Be wise. Be the spark." },
    { cycle: 3, day: 62, principle: "Guard your wealth from loss", message: "The same discipline that helps you save will help you protect. You have the discipline. Use it. Be the spark." },
    { cycle: 3, day: 63, principle: "Guard your wealth from loss", message: "Tomorrow, last deposit day. Your money is safe with you because you are learning. Be the spark." },
    { cycle: 3, day: 64, principle: "Guard your wealth from loss", message: "Cycle 3 complete. You now know how to save, grow, AND protect. You are becoming unbreakable. Be the spark." },
    
    // Cycle 4: Own Your Own Home (Days 65-85)
    { cycle: 4, day: 65, principle: "Own your own home", message: "New cycle. New lesson: 'Own your own home.' The rich man said: 'A man's wealth is not in the money he keeps, but in the land he owns.' Be the spark." },
    { cycle: 4, day: 66, principle: "Own your own home", message: "When you rent, you pay your landlord's mortgage. When you own, you pay yourself. One day, you will own. Be the spark." },
    { cycle: 4, day: 67, principle: "Own your own home", message: "You do not need a mansion. A small room, a plot of land, a shop — these are assets. They grow in value. Be the spark." },
    { cycle: 4, day: 68, principle: "Own your own home", message: "Start small. A plot in a developing area may be ₦500,000. Save ₦10,000 per month, you will have it in 50 months. That is 4 years. Time passes anyway. Be the spark." },
    { cycle: 4, day: 69, principle: "Own your own home", message: "Land does not run away. Land does not get stolen easily. Land only increases in value over years. Land is wealth. Be the spark." },
    { cycle: 4, day: 70, principle: "Own your own home", message: "If you cannot buy land, buy something else: a freezer for pure water business, a grinding machine, a phone for digital work. Own your tools. Be the spark." },
    { cycle: 4, day: 71, principle: "Own your own home", message: "The poor rent everything. The rich own. Today, ask yourself: 'What can I own in the next 6 months?' Be the spark." },
    { cycle: 4, day: 72, principle: "Own your own home", message: "Even if you live in a rented room, you can own a business. Own something that produces income. Be the spark." },
    { cycle: 4, day: 73, principle: "Own your own home", message: "In Babylon, slaves could become free men by owning assets. You are not a slave. You can own. Be the spark." },
    { cycle: 4, day: 74, principle: "Own your own home", message: "Every time you pay rent, you lose that money forever. Every time you pay mortgage on your own property, you keep the value. Be the spark." },
    { cycle: 4, day: 75, principle: "Own your own home", message: "Do not say 'I cannot afford to buy.' Say 'How can I afford to buy?' Your mind will find answers. Be the spark." },
    { cycle: 4, day: 76, principle: "Own your own home", message: "Saving for a home is different from saving for clothes. A home lasts 50 years. Clothes last 6 months. Choose wisely. Be the spark." },
    { cycle: 4, day: 77, principle: "Own your own home", message: "If 10 people save together, each can own something. Group ownership is better than no ownership. Be the spark." },
    { cycle: 4, day: 78, principle: "Own your own home", message: "Your daily savings of ₦500 becomes ₦182,500 in one year. In 3 years, that is ₦547,500. Enough for a small plot in many areas. Be the spark." },
    { cycle: 4, day: 79, principle: "Own your own home", message: "Do not compare yourself to those born with land. Compare yourself to who you were yesterday. You are improving. Be the spark." },
    { cycle: 4, day: 80, principle: "Own your own home", message: "Ownership changes your mind. When you own, you think differently. You protect. You improve. You grow. Be the spark." },
    { cycle: 4, day: 81, principle: "Own your own home", message: "Even a small asset is better than no asset. Start with something small. Let it grow. Be the spark." },
    { cycle: 4, day: 82, principle: "Own your own home", message: "Your grandparents may have owned land. Your parents may have lost it. You can get it back. Save. Own. Be the spark." },
    { cycle: 4, day: 83, principle: "Own your own home", message: "Land is the only thing that never decreases in value over long time. Gold fluctuates. Money loses value. Land stays. Be the spark." },
    { cycle: 4, day: 84, principle: "Own your own home", message: "Tomorrow, last deposit day. Picture yourself standing on land you own. That picture is possible. Be the spark." },
    { cycle: 4, day: 85, principle: "Own your own home", message: "Cycle 4 complete. You now understand ownership. One day, you will own. Not luck. Discipline. Be the spark." },
    
    // Cycle 5: Insure Your Future (Days 86-106)
    { cycle: 5, day: 86, principle: "Insure your future", message: "New cycle. New lesson: 'Insure your future.' The rich man said: 'Prepare for the days when you cannot work.' Be the spark." },
    { cycle: 5, day: 87, principle: "Insure your future", message: "Nobody knows tomorrow. Sickness, accident, job loss — these things happen. Your savings are your insurance. Be the spark." },
    { cycle: 5, day: 88, principle: "Insure your future", message: "Insurance companies charge you money to protect you. But your own savings protect you for free. Be your own insurance. Be the spark." },
    { cycle: 5, day: 89, principle: "Insure your future", message: "If you have 6 months of expenses saved, you can survive any emergency. That is real security. Be the spark." },
    { cycle: 5, day: 90, principle: "Insure your future", message: "Many Nigerians borrow money for funerals, hospital bills, school fees. Do not be one of them. Save for these before they come. Be the spark." },
    { cycle: 5, day: 91, principle: "Insure your future", message: "Your savings with TheSpark are available anytime. That is your emergency fund. Do not touch it for small things. Be the spark." },
    { cycle: 5, day: 92, principle: "Insure your future", message: "The rich man said: 'Have savings for your old age.' You will not be young forever. Save for future you. Be the spark." },
    { cycle: 5, day: 93, principle: "Insure your future", message: "If you have ₦100,000 saved, no small emergency can break you. That is freedom from fear. Be the spark." },
    { cycle: 5, day: 94, principle: "Insure your future", message: "Ask yourself: 'If I lose my job today, how many days can I survive?' If the answer is less than 30 days, you need more savings. Be the spark." },
    { cycle: 5, day: 95, principle: "Insure your future", message: "Do not rely on family for emergencies. They may have their own problems. Rely on your savings. Be the spark." },
    { cycle: 5, day: 96, principle: "Insure your future", message: "Your future self is watching you. Will you thank yourself or blame yourself? Save for future you. Be the spark." },
    { cycle: 5, day: 97, principle: "Insure your future", message: "In Babylon, wise men kept a portion of their gold for the 'lean years.' The lean years always come. Be ready. Be the spark." },
    { cycle: 5, day: 98, principle: "Insure your future", message: "You cannot predict the future. But you can prepare for it. Every day you save, you prepare. Be the spark." },
    { cycle: 5, day: 99, principle: "Insure your future", message: "Some people spend money as if they will live forever. Others save as if they will live long. The second group actually lives longer — with less stress. Be the spark." },
    { cycle: 5, day: 100, principle: "Insure your future", message: "Day 100 of your journey with TheSpark! Look how far you have come. Your future is brighter because of your past 100 days. Be the spark." },
    { cycle: 5, day: 101, principle: "Insure your future", message: "Emergency savings are not for new phones, not for parties, not for gifts. Emergency savings are for EMERGENCIES only. Be the spark." },
    { cycle: 5, day: 102, principle: "Insure your future", message: "When you have savings, you can say NO. No to bad jobs. No to bad loans. No to begging. Savings give you power. Be the spark." },
    { cycle: 5, day: 103, principle: "Insure your future", message: "The rich man said: 'A small leak can sink a great ship.' Small, unnecessary spending destroys wealth. Plug the leaks. Be the spark." },
    { cycle: 5, day: 104, principle: "Insure your future", message: "Your future includes your children. Save for their education. Save for their start in life. Break the poverty cycle. Be the spark." },
    { cycle: 5, day: 105, principle: "Insure your future", message: "Tomorrow, last deposit day. Every day you save, you buy peace of mind. That is priceless. Be the spark." },
    { cycle: 5, day: 106, principle: "Insure your future", message: "Cycle 5 complete. You now have an emergency mindset. You are prepared. You are secure. Be the spark." },
    
    // Cycle 6: Increase Your Ability to Earn (Days 107-127)
    { cycle: 6, day: 107, principle: "Increase your ability to earn", message: "New cycle. New lesson: 'Increase your ability to earn.' The richest man said: 'The most valuable investment is in yourself.' Be the spark." },
    { cycle: 6, day: 108, principle: "Increase your ability to earn", message: "You can only save what you earn. If you want to save more, earn more. Learn new skills. Start side businesses. Grow. Be the spark." },
    { cycle: 6, day: 109, principle: "Increase your ability to earn", message: "A farmer who learns better farming grows more crops. A trader who learns marketing sells more goods. What can you learn? Be the spark." },
    { cycle: 6, day: 110, principle: "Increase your ability to earn", message: "In Nigeria, there are free courses online. YouTube teaches skills. Learn digital marketing, phone repair, catering, farming. Add value to yourself. Be the spark." },
    { cycle: 6, day: 111, principle: "Increase your ability to earn", message: "Do not spend all your free time on entertainment. Spend some time learning. Every hour of learning increases your future income. Be the spark." },
    { cycle: 6, day: 112, principle: "Increase your ability to earn", message: "The rich man said: 'The more you know, the more you earn.' Knowledge is the only wealth no one can steal. Be the spark." },
    { cycle: 6, day: 113, principle: "Increase your ability to earn", message: "If you learn one new skill every 6 months, in 5 years you have 10 skills. That is 10 ways to earn money. Be the spark." },
    { cycle: 6, day: 114, principle: "Increase your ability to earn", message: "Do not say 'I am too old to learn.' The richest man in Babylon started as a slave. He learned. He grew. You can too. Be the spark." },
    { cycle: 6, day: 115, principle: "Increase your ability to earn", message: "Ask someone successful: 'What did you learn that changed your life?' Their answer may change yours. Be the spark." },
    { cycle: 6, day: 116, principle: "Increase your ability to earn", message: "Your daily savings habit proves you have discipline. Now apply that discipline to learning. Same muscle. Be the spark." },
    { cycle: 6, day: 117, principle: "Increase your ability to earn", message: "A man with one skill has one income. A man with five skills has five incomes. Which man sleeps better at night? Be the spark." },
    { cycle: 6, day: 118, principle: "Increase your ability to earn", message: "Do not be ashamed to start small. A roadside phone charging business needs only ₦10,000 to start. That is extra income. Be the spark." },
    { cycle: 6, day: 119, principle: "Increase your ability to earn", message: "Learn about money. Read The Richest Man in Babylon. Read Rich Dad Poor Dad. Read one page per day. Knowledge compounds like interest. Be the spark." },
    { cycle: 6, day: 120, principle: "Increase your ability to earn", message: "Your ability to earn is unlimited. The only limit is your belief. Believe you can earn more. Then learn how. Be the spark." },
    { cycle: 6, day: 121, principle: "Increase your ability to earn", message: "Find a mentor. Someone who has what you want. Ask them to teach you. Most successful people will help if you are serious. Be the spark." },
    { cycle: 6, day: 122, principle: "Increase your ability to earn", message: "Do not compare your beginning to someone else's middle. Every expert was once a beginner. Start learning today. Be the spark." },
    { cycle: 6, day: 123, principle: "Increase your ability to earn", message: "If you earn ₦50,000 per month and learn a skill that increases it to ₦70,000 — that extra ₦20,000 is pure profit from learning. Be the spark." },
    { cycle: 6, day: 124, principle: "Increase your ability to earn", message: "The internet is free. Libraries are free. Smart friends are free. Free knowledge is everywhere. Take it. Be the spark." },
    { cycle: 6, day: 125, principle: "Increase your ability to earn", message: "Tomorrow, after you save, spend 30 minutes learning something new. One video. One article. One conversation. Be the spark." },
    { cycle: 6, day: 126, principle: "Increase your ability to earn", message: "Tomorrow is your last deposit day. Your savings are growing. Your knowledge is growing. You are becoming a complete person. Be the spark." },
    { cycle: 6, day: 127, principle: "Increase your ability to earn", message: "Cycle 6 complete. You now understand: Wealth is not just saved. Wealth is earned. Earn more, save more, grow more. Be the spark." },
    
    // Cycle 7: Teach Others (Days 128-148)
    { cycle: 7, day: 128, principle: "Teach others", message: "New cycle. New lesson: 'Teach others.' The richest man in Babylon did not keep his secrets. He taught the whole city. Be the spark." },
    { cycle: 7, day: 129, principle: "Teach others", message: "You have learned to save. You have learned to grow. You have learned to protect. Now teach someone else. Be the spark." },
    { cycle: 7, day: 130, principle: "Teach others", message: "When you teach, you learn twice. Explaining wealth to others strengthens your own wealth habits. Be the spark." },
    { cycle: 7, day: 131, principle: "Teach others", message: "Look at your family. Your neighbors. Your friends. Who is struggling? Who can you help with what you have learned? Be the spark." },
    { cycle: 7, day: 132, principle: "Teach others", message: "Do not force people. But when they ask how you are saving, tell them about TheSpark. Your example is powerful. Be the spark." },
    { cycle: 7, day: 133, principle: "Teach others", message: "In Babylon, the richest man said: 'Show me a man who teaches others, and I will show you a man who will never be poor.' Be the spark." },
    { cycle: 7, day: 134, principle: "Teach others", message: "Poverty in Nigeria will not end by government alone. It will end when we teach each other. You are now a teacher of TheSpark. Be the spark." },
    { cycle: 7, day: 135, principle: "Teach others", message: "Start with one person. Teach them to save ₦100 per day with TheSpark. If they learn, you have changed a life. That is legacy. Be the spark." },
    { cycle: 7, day: 136, principle: "Teach others", message: "Do not be proud. Do not say 'I know everything.' But share what you know. Knowledge shared is knowledge multiplied. Be the spark." },
    { cycle: 7, day: 137, principle: "Teach others", message: "The person you teach today may teach 10 people next year. Those 10 may teach 100. You started a wealth chain. Be the spark." },
    { cycle: 7, day: 138, principle: "Teach others", message: "In your community, poverty is normal. Change that normal. Be the abnormal one who saves, learns, and teaches TheSpark. Be the spark." },
    { cycle: 7, day: 139, principle: "Teach others", message: "You do not need a degree to teach saving. You just need a story. Your story with TheSpark is powerful. Be the spark." },
    { cycle: 7, day: 140, principle: "Teach others", message: "When you teach, you become accountable. You cannot stop saving because someone is watching you. That is good. Be the spark." },
    { cycle: 7, day: 141, principle: "Teach others", message: "The richest man said: 'Wealth grows where wisdom is shared.' Share your wisdom. Watch wealth grow. Be the spark." },
    { cycle: 7, day: 142, principle: "Teach others", message: "If every Nigerian taught one person to save with TheSpark, in 10 years, poverty would be cut in half. Be that one person. Be the spark." },
    { cycle: 7, day: 143, principle: "Teach others", message: "Do not be afraid they will surpass you. If they do, you taught well. And you can learn from them too. Be the spark." },
    { cycle: 7, day: 144, principle: "Teach others", message: "Teaching is not lecturing. Teaching is showing. Live your wealth habits. Others will see and ask about TheSpark. Be the spark." },
    { cycle: 7, day: 145, principle: "Teach others", message: "Your children are watching you. When you save daily with TheSpark, you teach them without words. That is the best teaching. Be the spark." },
    { cycle: 7, day: 146, principle: "Teach others", message: "If you bring someone to TheSpark, you earn a referral. But more than money, you earn the joy of changing a life. Be the spark." },
    { cycle: 7, day: 147, principle: "Teach others", message: "Tomorrow, last deposit day. Think of one person you will teach next cycle. Prepare for them. Be the spark." },
    { cycle: 7, day: 148, principle: "Teach others", message: "Cycle 7 complete. You are now a teacher of TheSpark. You have not just changed yourself. You will change others. Be the spark." },
    
    // Cycle 8: Graduate and Invest (Days 149-169)
    { cycle: 8, day: 149, principle: "Graduate and invest", message: "Final cycle. Final lesson: 'Graduate and invest.' You have completed 7 cycles with TheSpark. You are ready for the next level. Be the spark." },
    { cycle: 8, day: 150, principle: "Graduate and invest", message: "Look at your balance. That money is not just savings. It is your launch pad. Your freedom fund. Your future. Be the spark." },
    { cycle: 8, day: 151, principle: "Graduate and invest", message: "You have learned to save. Now learn to invest. Saving keeps money safe. Investing makes money grow faster. Be the spark." },
    { cycle: 8, day: 152, principle: "Graduate and invest", message: "In the next days, TheSpark will introduce you to real investment opportunities. Lending. Assets. Businesses. Choose wisely. Be the spark." },
    { cycle: 8, day: 153, principle: "Graduate and invest", message: "Do not rush. Do not invest everything. Keep some savings safe. Invest only what you can afford to leave for a while. Be the spark." },
    { cycle: 8, day: 154, principle: "Graduate and invest", message: "The richest man said: 'First learn to save. Then learn to invest. Never reverse the order.' You have done it correctly with TheSpark. Be the spark." },
    { cycle: 8, day: 155, principle: "Graduate and invest", message: "Investment is not gambling. Gambling is luck. Investment is knowledge + patience + discipline. You have all three. Be the spark." },
    { cycle: 8, day: 156, principle: "Graduate and invest", message: "When you invest, ask: 'What is the risk? What is the return? How long must I wait?' If you cannot answer, do not invest. Be the spark." },
    { cycle: 8, day: 157, principle: "Graduate and invest", message: "You can start investing with small amounts. ₦5,000 in a lending pool. ₦10,000 in a business partnership. Small starts lead to big wins. Be the spark." },
    { cycle: 8, day: 158, principle: "Graduate and invest", message: "Your daily savings habit with TheSpark has prepared you. Investing is just saving in a different form — with higher returns and slightly higher risk. Be the spark." },
    { cycle: 8, day: 159, principle: "Graduate and invest", message: "Do not invest in what you do not understand. If TheSpark introduces an opportunity, ask questions. Understand fully before committing. Be the spark." },
    { cycle: 8, day: 160, principle: "Graduate and invest", message: "Diversify. Do not put all your money in one investment. Spread across lending, assets, training, and savings. Be the spark." },
    { cycle: 8, day: 161, principle: "Graduate and invest", message: "The richest man said: 'Advice from wise men is better than gold.' Seek advice before you invest. Your TheSpark Coach will help you. Be the spark." },
    { cycle: 8, day: 162, principle: "Graduate and invest", message: "After this cycle, you will receive your TheSpark graduation certificate. You will join the alumni group. You will never be alone in your wealth journey. Be the spark." },
    { cycle: 8, day: 163, principle: "Graduate and invest", message: "Some of you will become lenders. Some will become asset owners. Some will start businesses. All will be wealthy. Be the spark." },
    { cycle: 8, day: 164, principle: "Graduate and invest", message: "Do not stop saving after graduation. Saving daily with TheSpark is for life. Investing is additional. Save first, then invest. Be the spark." },
    { cycle: 8, day: 165, principle: "Graduate and invest", message: "You came to TheSpark with little. You leave with savings, knowledge, discipline, and hope. That is wealth. Be the spark." },
    { cycle: 8, day: 166, principle: "Graduate and invest", message: "Three days left. Your final interest payment is coming. Your graduation is coming. Your new life is coming. Be the spark." },
    { cycle: 8, day: 167, principle: "Graduate and invest", message: "Two days left. Prepare your mind. You are no longer a student. You are a graduate of TheSpark. You are an investor. Be the spark." },
    { cycle: 8, day: 168, principle: "Graduate and invest", message: "Tomorrow is your last deposit day of TheSpark program. Make it memorable. Be the spark." },
    { cycle: 8, day: 169, principle: "Graduate and invest", message: "CONGRATULATIONS! You have completed 8 cycles. 6 months. 168 days of saving with TheSpark. You are now a graduate of TheSpark Wealth Building Program. Your certificate awaits. Your future awaits. Go and be wealthy — and teach others to do the same. Be the spark." }
];

async function seedMessages() {
    const batch = db.batch();
    
    for (const msg of messages) {
        const docRef = db.collection('dailyMessages').doc();
        batch.set(docRef, msg);
    }
    
    await batch.commit();
    console.log(`Seeded ${messages.length} daily messages`);
}

seedMessages().catch(console.error);