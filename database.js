// database.js
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  socketPath: process.env.DB_SOCKET || null,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

class QueryBuilder {
  constructor(table) {
    this.table = table;
    this._select = '*';
    this._wheres = [];
    this._params = [];
    this._limit = null;
    this._order = null;
    this._group = null;
  }

  select(fields) {
    this._select = Array.isArray(fields) ? fields.join(', ') : fields;
    return this;
  }

  where(column, operator, value) {
    if (value === undefined) {
      throw new Error(`WHERE parameter for column "${column}" is undefined`);
    }

    if (value === null) {
      if (operator === '=')
        this._wheres.push(`${column} IS NULL`);
      else if (operator === '!=' || operator === '<>')
        this._wheres.push(`${column} IS NOT NULL`);
      else
        throw new Error(`Cannot use operator "${operator}" with NULL`);
    } else {
      this._wheres.push(`${column} ${operator} ?`);
      this._params.push(value);
    }

    return this;
  }


  whereRaw(condition, params = []) {
    this._wheres.push(condition);
    this._params.push(...params);
    return this;
  }

  whereIn(column, values) {
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error('whereIn requires a non-empty array of values');
    }
    // Separate nulls and non-nulls
    const nonNulls = values.filter(v => v !== null && v !== undefined);
    const hasNull = values.some(v => v === null || v === undefined);

    let clauseParts = [];
    if (nonNulls.length > 0) {
      const placeholders = nonNulls.map(() => '?').join(', ');
      clauseParts.push(`${column} IN (${placeholders})`);
    }
    if (hasNull) {
      clauseParts.push(`${column} IS NULL`);
    }
    this._wheres.push(`(${clauseParts.join(' OR ')})`);
    this._params.push(...nonNulls);
    return this;
  }

  orderBy(column, direction = 'ASC') {
    this._order = `${column} ${direction}`;
    return this;
  }

  limit(count) {
    this._limit = count;
    return this;
  }


  whereNull(column) {
    this._wheres.push(`${column} IS NULL`);
    return this;
  }

  whereNotNull(column) {
    this._wheres.push(`${column} IS NOT NULL`);
    return this;
  }

  count(column = '*', alias = 'count') {
    if (this._select && this._select !== '*') {
      this._select += `, COUNT(${column}) as ${alias}`;
    } else {
      this._select = `COUNT(${column}) as ${alias}`;
    }
    return this;
  }


  sum(column, alias = 'sum') {
    this._select = `SUM(${column}) as ${alias}`;
    return this;
  }

  groupBy(column) {
    this._group = column;
    return this;
  }


  async get() {
    let sql = `SELECT ${this._select} FROM ${this.table}`;
    if (this._wheres.length) {
      sql += ` WHERE ${this._wheres.join(' AND ')}`;
    }
    if (this._group) {
      sql += ` GROUP BY ${this._group}`;
    }
    if (this._order) {
      sql += ` ORDER BY ${this._order}`;
    }
    if (this._limit !== null) {
      sql += ` LIMIT ${this._limit}`;
    }

    const [rows] = await pool.execute(sql, this._params);
    return rows;
  }

  async first() {
    this.limit(1);
    const rows = await this.get();
    return rows[0] || null;
  }

  async insert(data) {
    const columns = Object.keys(data);
    const placeholders = columns.map(() => '?').join(', ');
    const values = Object.values(data);
    const sql = `INSERT INTO ${this.table} (${columns.join(', ')}) VALUES (${placeholders})`;
    const [result] = await pool.execute(sql, values);
    return result.insertId;
  }

  async update(data) {
    if (!this._wheres.length) throw new Error('Update must have a where clause');

    const columns = Object.keys(data);
    const setClause = columns.map(col => `${col} = ?`).join(', ');
    const values = Object.values(data);

    const sql = `UPDATE ${this.table} SET ${setClause} WHERE ${this._wheres.join(' AND ')}`;
    const [result] = await pool.execute(sql, [...values, ...this._params]);
    return result.affectedRows;
  }

  async delete() {
    if (!this._wheres.length) throw new Error('Delete must have a where clause');

    const sql = `DELETE FROM ${this.table} WHERE ${this._wheres.join(' AND ')}`;
    const [result] = await pool.execute(sql, this._params);
    return result.affectedRows;
  }

  async increment(column, amount = 1) {
    if (!this._wheres.length) throw new Error('Increment must have a where clause');

    const sql = `UPDATE ${this.table} SET ${column} = ${column} + ? WHERE ${this._wheres.join(' AND ')}`;
    const [result] = await pool.execute(sql, [amount, ...this._params]);
    return result.affectedRows;
  }

  async decrement(column, amount = 1) {
    if (!this._wheres.length) throw new Error('Decrement must have a where clause');

    const sql = `UPDATE ${this.table} SET ${column} = ${column} - ? WHERE ${this._wheres.join(' AND ')}`;
    const [result] = await pool.execute(sql, [amount, ...this._params]);
    return result.affectedRows;
  }









}

module.exports = function (table) {
  return new QueryBuilder(table);
};
