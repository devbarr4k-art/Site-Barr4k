const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', 'admin', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Update Table Headers
content = content.replace(
  '<th className="px-6 py-4">Coins Investidas</th>',
  '<th className="px-6 py-4">Coins Investidas</th>\n                          <th className="px-6 py-4">ID da Casa</th>'
);

// Update Edit View
content = content.replace(
  '<td className="px-6 py-4">\n                                  <input \n                                    type="number" \n                                    value={editCoinsUsed} \n                                    onChange={(e) => setEditCoinsUsed(Number(e.target.value))}\n                                    className="bg-black border border-gray-700 rounded px-2 py-1 text-white w-20 outline-none focus:border-purple-500" \n                                  />\n                                </td>',
  `<td className="px-6 py-4">
                                  <input 
                                    type="number" 
                                    value={editCoinsUsed} 
                                    onChange={(e) => setEditCoinsUsed(Number(e.target.value))}
                                    className="bg-black border border-gray-700 rounded px-2 py-1 text-white w-20 outline-none focus:border-purple-500" 
                                  />
                                </td>
                                <td className="px-6 py-4 font-bold text-gray-400">
                                  {p.instagram || "N/A"}
                                </td>`
);

// Update Normal View
content = content.replace(
  '<td className="px-6 py-4 font-bold text-yellow-500">{p.coins_used}</td>',
  '<td className="px-6 py-4 font-bold text-yellow-500">{p.coins_used}</td>\n                                <td className="px-6 py-4 font-bold text-gray-400">{p.instagram || "N/A"}</td>'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated admin table');
