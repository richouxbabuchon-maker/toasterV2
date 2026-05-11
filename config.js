module.exports = {
    token: process.env.TOKEN,

    guildId: "1499426593616166932",

    // Role Staff principal
    staffRole: "1499426877163704370",

    // Logs
    logsChannel: "1503049149493284924",

    // Bypass
    bypassRoles: ["1499426877163704370",],

    // Role donné si validé
    acceptedRole: "1503136343906320474",

    // Categories
    categories: {
        recrutement: "1503048688673624084",
        contacter_la_direction: "1503048714607136808",
        partenariats: "1503048737835057202"
        
    },

    // Ticket emojis
    ticketEmojis: {
        recrutement: "📋",
        contacter_la_direction: "⚠️",
        partenariats: "🤝"
    },

    // Catégories si validé
    validatedCategory: "1503136840658452511",

    
};

console.log("CONFIG FILE LOADED")
