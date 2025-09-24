module.exports = {
  plugins: ["@trivago/prettier-plugin-sort-imports"],
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  tabWidth: 2,
  printWidth: 100,
  importOrder: ["^@/", "^[./]"],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
};
