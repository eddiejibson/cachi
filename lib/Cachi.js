const Redis = require("ioredis");
class Cachi {
  /**
   * Get the current stored (cached) value for current endpoint/route with certain criteria (if any)
   * @param {string} redis Redis connection object, string URI or existing ioredis instance/connection
   * @param {Object} [opts={}}] Cachi options (redis keynames e.t.c)
   */
  constructor(redis = "redis://127.0.0.1/0", opts = {}) {
    if (
      typeof redis === "string" ||
      (typeof redis === "object" && redis.host)
    ) {
      this.db = new Redis(redis);
    } else {
      //Assuming passing in ioredis instance
      this.db = redis;
    }

    this.opts = {
      keyName: opts.keyName || "cache",
    };
  }

  /**
   * Get the current stored (cached) value for current endpoint/route with certain criteria (if any)
   * @param {string} [name=null] Route or endpoint's name
   * @param {Object} [criteria=null] Client must have the same criteria (e.g requested data) to have same cached resource returned
   */

  _getFromReq(obj, req) {
    let final = {};
    let objKeys = Object.keys(obj);
    for (let i = 0; i < objKeys.length; i++) {
      let key = objKeys[i];
      let el = obj[key];
      if (Array.isArray(el)) {
        for (let i2 = 0; i2 < el.length; i2++) {
          let valueToExtract = el[i2];
          if (!final[key]) final[key] = {};
          final[key][valueToExtract] = req[key][valueToExtract];
        }
      } else {
        final[key] = el;
      }
    }
    return final;
  }
  check(name, criteria = false) {
    return async (req, res, next) => {
      let actualCriteria = JSON.parse(JSON.stringify(criteria)); //TODO: please someone help, seems criteria will be changed and not the same value it always was - this is the only way to get out of it :(
      if (actualCriteria.req) {
        actualCriteria.req = this._getFromReq(actualCriteria.req, req);
      }
      let actualName = name ? name : this._computeName(req);
      let result = await this.get(actualName, actualCriteria).catch((err) => {
        return next();
      });
      if (result) {
        result = JSON.parse(result);
        return res.status(324)[result.plain ? "send" : "json"](result.data);
      } else {
        return next();
      }
    };
  }

  processCriteriaName(name, criteria) {
    if (criteria) {
      if (typeof criteria === "object") {
        name += JSON.stringify(criteria);
      } else {
        name += criteria;
      }
      name = this._hash(name); //Don't want a huge JSON keyname so a simple non crypto hash will be generated
    }
    return name;
  }

  /**
   * Get the current stored (cached) value for current endpoint/route with certain criteria (if any)
   * @param {string} name Route or endpoint's name
   * @param {Object} [criteria=null] Client must have the same criteria (e.g requested data) to have same cached resource returned
   */
  async get(name, criteria = null) {
    name = this.processCriteriaName(name, criteria);
    return await this.db
      .get((this.opts.keyName || "cache") + ":" + name)
      .catch((err) => {
        next(err);
      });
  }

  /**
   * Get the current stored (cached) value for current endpoint/route with certain criteria (if any)
   * @param  {string} name Route or endpoint's name
   * @param  {Object|string} data Returned data for endpoint based on certain (if any) criteria
   * @param  {number} [expiry=3600] Amount of time in seconds for cache to expire in
   * @param  {Object} [criteria=null] What request data must be the same for the same cached result to be returned

   */
  async set(name, data, expiry = 3600, criteria = null) {
    let obj = { data: data || null };
    if (typeof data === "string") {
      obj.plain = true;
    }
    obj = JSON.stringify(obj);
    name = this.processCriteriaName(name, criteria);
    return await this.db
      .setex(this.opts.keyName + ":" + name, expiry, obj)
      .catch((err) => {
        return Promise.reject(err);
      });
  }

  _computeName(req) {
    return req.baseUrl + req.path;
  }
  _hash(val) {
    let hash = 0;
    for (var i = 0; i < val.length; i++) {
      var char = val.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 32 bit
    }
    return hash;
  }
}

module.exports = Cachi;
