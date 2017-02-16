/**
 * @fileoverview Support for 36-bit integers (using unsigned JavaScript numbers)
 * @author <a href="mailto:Jeff@pcjs.org">Jeff Parsons</a> (@jeffpar)
 * @copyright © Jeff Parsons 2012-2017
 *
 * This file is part of PCjs, a computer emulation software project at <http://pcjs.org/>.
 *
 * PCjs is free software: you can redistribute it and/or modify it under the terms of the
 * GNU General Public License as published by the Free Software Foundation, either version 3
 * of the License, or (at your option) any later version.
 *
 * PCjs is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without
 * even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with PCjs.  If not,
 * see <http://www.gnu.org/licenses/gpl.html>.
 *
 * You are required to include the above copyright notice in every modified copy of this work
 * and to display that copyright notice when the software starts running; see COPYRIGHT in
 * <http://pcjs.org/modules/shared/lib/defines.js>.
 *
 * Some PCjs files also attempt to load external resource files, such as character-image files,
 * ROM files, and disk image files. Those external resource files are not considered part of PCjs
 * for purposes of the GNU General Public License, and the author does not claim any copyright
 * as to their contents.
 */

"use strict";

var DEBUG = true;

/**
 * @class Int36
 * @property {number} value
 * @property {number|null} extended
 * @property {number|null} remainder
 * @property {number} error
 *
 * The 'value' property stores the 36-bit value as an unsigned integer.  When the value
 * should be interpreted as a signed quantity, subtract BIT36 whenever value > MAXPOS.
 *
 * The 'extended' property stores an additional 36 bits of data from a multiplication;
 * it must also be set prior to a division.  Internally, it will be set to null whenever the
 * current value is not extended.
 *
 * The 'remainder' property stores the remainder from the last division.  You should assume it
 * will be set to null by any other operation.
 *
 * The 'error' property records any error(s) from the last operation.
 */

class Int36 {
    /**
     * Int36(obj, extended)
     *
     * The constructor, which simply calls set(), creates an Int36 from either:
     *
     *      1) another Int36
     *      2) a single 36-bit value, with an optional 36-bit extension
     *      3) nothing (initial value will be zero)
     *
     * All internal Int36 values (ie, the value and any extension) are unsigned values in the range:
     *
     *      0 <= i <= Math.pow(2, 36) - 1
     *
     * The lower bound is ZERO and the upper bound is Int36.MAXVAL.  Whenever an Int36 value should be
     * interpreted as a signed value, values above Int36.MAXPOS (ie, values with bit 35 set) should be
     * converted to their signed counterpart by subtracting the value from Int36.BIT36 (aka MAXVAL + 1);
     * the easiest way to do that is call isNegative() to check the sign bit and then call negate() as
     * appropriate.
     *
     * NOTE: We use modern bit numbering, where bit 0 is the right-most (least-significant) bit and
     * bit 35 is the left-most bit.  This is opposite of the PDP-10 convention, which defined bit 0 as the
     * left-most bit and bit 35 as the right-most bit.
     *
     * Although the integer precision of JavaScript floating-point (IEEE 754 double-precision) numbers is:
     *
     *      -Math.pow(2, 53) <= i <= Math.pow(2, 53)
     *
     * it seems unwise to ever permit our internal values to creep outside the 36-bit range, because
     * floating-point operations will drop least-significant bits in favor of most-significant bits when a
     * result becomes too large, which is the opposite of what integer operations traditionally do.  There
     * might be some optimization benefits to performing our internal 36-bit truncation "lazily", but at
     * least initially, I prefer to truncate() the results of all 36-bit arithmetic operations immediately.
     *
     * Most of the Int36 operations come in two flavors: those that accept numbers, and those that accept
     * another Int36.  The latter are more efficient, because (as just explained) an Int36's internal value
     * should always be in range, whereas external numbers could be out of range OR have a fractional value
     * OR be something else entirely (NaN, Infinity, -Infinity, undefined, etc), so numeric inputs are
     * always passed through the static validate() function.
     *
     * We could eliminate the two flavors and check each parameter's type, like we do in the constructor,
     * but constructor calls are infrequent (if they're not, you're doing something wrong), whereas Int36-only
     * operations should be as fast and unchecked as possible.
     *
     * @this {Int36}
     * @param {Int36|number} [obj] (if omitted, the default is zero)
     * @param {number|null} [extended]
     */
    constructor(obj, extended)
    {
        this.set(obj, extended);
        this.bitsRes = [0, 0];
        this.bitsPow = [0, 0];
        this.bitsDiv = [0, 0];
        this.bitsRem = [0, 0];
    }

    /**
     * set(obj, extended)
     *
     * @this {Int36}
     * @param {Int36|number} [obj] (if omitted, the default is zero)
     * @param {number|null} [extended]
     */
    set(obj = 0, extended)
    {
        if (obj instanceof Int36) {
            this.value = obj.value;
            this.extended = obj.extended;
            this.remainder = obj.remainder;
        }
        else {
            this.value = Int36.validate(obj || 0);
            this.extended = null;
            /*
             * NOTE: Surprisingly, isNaN(null) is false, whereas isNaN(undefined) is true.  Go figure.
             */
            if (extended != null && !isNaN(extended)) {
                this.extended = Int36.validate(extended);
            }
            this.remainder = null;
        }
        this.error = Int36.ERROR.NONE;
    }

    /**
     * toDecimal(fUnsigned)
     *
     * @this {Int36}
     * @param {boolean} fUnsigned
     * @return {string}
     */
    toDecimal(fUnsigned)
    {
        var s = "", fNeg = false;
        var i36Div = new Int36(10000000000);
        var i36Rem = new Int36();
        var i36Tmp = new Int36(this.value, this.extended);
        if (!fUnsigned && i36Tmp.isNegative()) {
            i36Tmp.negate();
            fNeg = true;
        }
        do {
            i36Tmp.div(i36Div);
            if (i36Tmp.error) {
                s = "error";
                break;
            }
            var quotient = i36Tmp.value || i36Tmp.extended;
            var nMinDigits = (quotient? 10 : 1);
            i36Rem.set(i36Tmp.remainder);
            do {
                i36Rem.divNum(10);
                s = String.fromCharCode(0x30 + i36Rem.remainder) + s;
            } while (--nMinDigits > 0 || i36Rem.value);
        } while (quotient);
        if (fNeg) s = '-' + s;
        return s;
    }

    /**
     * toString(radix, fUnsigned)
     *
     * @this {Int36}
     * @param {number} [radix] (default is 10)
     * @param {boolean} [fUnsigned] (default is signed for radix 10, unsigned for any other radix)
     * @return {string}
     */
    toString(radix = 10, fUnsigned)
    {
        if (radix == 10) {
            return this.toDecimal(fUnsigned);
        }

        var value = this.value;
        var extended = this.extended;

        if (radix == 8) {
            var s = Int36.octal(value);
            if (extended) {
                s = Int36.octal(extended) + ',' + s;
            }
            if (this.remainder) {
                s += ':' + Int36.octal(this.remainder);
            }
            if (DEBUG && this.error) s += " error 0x" + this.error.toString(16);
            return s;
        }

        if (extended != null) {
            /*
             * TODO: Need a radix-independent solution for these extended (up to 72-bit) values,
             * because after 52 bits, JavaScript will start dropping least-significant bits.  Until
             * then, you're better off sticking with octal (see above).
             */
            value = extended * Int36.BIT36 + value;
        }
        return value.toString(radix);
    }

    /**
     * truncate(result, operand, fSub)
     *
     * The range of valid results (0 - MAXVAL) is divided into two equal sub-ranges: 0 to MAXPOS,
     * where the sign bit is zero (the bottom range), and MAXPOS+1 to MAXVAL (the top range), where
     * the sign bit is one.  During a single arithmetic operation, the result can "wrap around" from
     * the bottom range to the top, or from the top range to the bottom, but it's an overflow/underflow
     * error ONLY if the result "wraps across" the midpoint between the two ranges, producing an
     * unnaturally small delta (<= MAXPOS).
     *
     * This can be confirmed independently by examining the sign bits (BIT35) of the original value
     * (V), the operand (O), the result (R), as well as two intermediate calculations, VR = (V ^ R)
     * and OR = (O ^ R), and a final calculation: E = (VR & OR).  In the case of subtraction (fSub),
     * OV replaces OR.
     *
     *      V   O   R   VR  OR  E
     *      -   -   -   --  --  -
     *      0   0   0   0   0   0
     *      0   0   1   1   1   1 (adding positive to positive yielded negative: overflow)
     *      0   1   0   0   1   0
     *      0   1   1   1   0   0
     *      1   0   0   1   0   0
     *      1   0   1   0   1   0
     *      1   1   0   1   1   1 (adding negative to negative yielded positive: underflow)
     *      1   1   1   0   0   0
     *
     *      V   O   R   VR  OV  E
     *      -   -   -   --  --  -
     *      0   0   0   0   0   0
     *      0   0   1   1   0   0
     *      0   1   0   0   1   0
     *      0   1   1   1   1   1 (subtracting negative from positive yielded negative: overflow)
     *      1   0   0   1   1   1 (subtracting positive from negative yielded positive: underflow)
     *      1   0   1   0   1   0
     *      1   1   0   1   0   0
     *      1   1   1   0   0   0
     *
     * NOTE: This function's job is to truncate the result of an operation to 36-bit accuracy,
     * not to remove any fractional portion that might also exist.  If an operation could have produced
     * a non-integer result (eg, div()), it's the caller's responsibility to deal with that first.
     *
     * @this {Int36}
     * @param {number} result
     * @param {number} [operand]
     * @param {boolean} [fSub] (true if operand was subtracted)
     * @return {number}
     */
    truncate(result, operand, fSub)
    {
        if (DEBUG && result !== Math.trunc(result)) {
            console.log("Int36.truncate(" + result + " is not an integer)");
        }

        this.extended = null;
        this.remainder = null;
        this.error = Int36.ERROR.NONE;

        if (result < 0) {
            result += Int36.BIT36;
        }

        result %= Int36.BIT36;

        /*
         * We don't actually need to know what the operand was to determine overflow or underflow
         * for addition or subtraction, just the original value (this.value) the new value (result).
         *
         * We do, however, need to know the operand if we want to confirm our error calculation using
         * the truth table above, which requires examining the sign bits of all the inputs and outputs.
         */
        if (operand !== undefined) {
            /*
             * Calculating V, R, O, and E as described above is somewhat tedious, because bits
             * above bit 31 cannot be accessed directly; we shift all the sign bits down to bit 0
             * using division first.  We don't need to truncate the results, because the subsequent
             * bit-wise operations perform truncation automatically.
             */
            var e = 0;
            if (DEBUG) {
                var v = this.value / Int36.BIT35, r = result / Int36.BIT35, o = operand / Int36.BIT35;
                e = ((v ^ r) & (o ^ (fSub? v : r))) & 1;
            }
            if ((result > Int36.MAXPOS) != (this.value > Int36.MAXPOS)) {
                var delta = result - this.value;
                if (Math.abs(delta) <= Int36.MAXPOS) {
                    this.error |= (delta > 0 ? Int36.ERROR.OVERFLOW : Int36.ERROR.UNDERFLOW);
                    if (DEBUG && (delta > 0) != !(e & v)) e = 0;
                }
            }
            if (DEBUG && (!this.error) != (!e)) console.log("overflow mismatch");
        }
        return result;
    }

    /**
     * add(i36)
     *
     * @this {Int36}
     * @param {Int36} i36
     */
    add(i36)
    {
        this.value = this.truncate(this.value + i36.value, i36.value);
    }

    /**
     * addNum(num)
     *
     * @this {Int36}
     * @param {number} num
     */
    addNum(num)
    {
        num = Int36.validate(num);
        this.value = this.truncate(this.value + num, num);
    }

    /**
     * sub(i36)
     *
     * @this {Int36}
     * @param {Int36} i36
     */
    sub(i36)
    {
        this.value = this.truncate(this.value - i36.value, i36.value, true);
    }

    /**
     * subNum(num)
     *
     * @this {Int36}
     * @param {number} num
     */
    subNum(num)
    {
        num = Int36.validate(num);
        this.value = this.truncate(this.value - num, num, true);
    }

    /**
     * mul(i36)
     *
     * @this {Int36}
     * @param {Int36} i36
     */
    mul(i36)
    {
        this.mulExtended(i36.value);
    }

    /**
     * mulNum(num)
     *
     * @this {Int36}
     * @param {number} num
     */
    mulNum(num)
    {
        this.mulExtended(Int36.validate(num));
    }

    /**
     * mulExtended(value)
     *
     * To support 72-bit results, we perform the multiplication process as you would "by hand",
     * treating each of the operands to be multiplied as two 2-digit numbers, where each digit is
     * an 18-bit number (base 2^18).  Each individual multiplication of these 18-bit "digits"
     * will produce a result within 2^36, well within JavaScript integer accuracy.
     *
     * @this {Int36}
     * @param {number} value
     */
    mulExtended(value)
    {
        var fNeg = false, extended;
        var n1 = this.value, n2 = value;

        if (n1 > Int36.MAXPOS) {
            n1 = Int36.BIT36 - n1;
            fNeg = !fNeg;
        }

        if (n2 > Int36.MAXPOS) {
            n2 = Int36.BIT36 - n2;
            fNeg = !fNeg;
        }

        if (n1 < Int36.BIT18 && n2 < Int36.BIT18) {
            value = n1 * n2;
            extended = 0;
        }
        else {
            var n1d1 = (n1 % Int36.BIT18);
            var n1d2 = Math.trunc(n1 / Int36.BIT18);
            var n2d1 = (n2 % Int36.BIT18);
            var n2d2 = Math.trunc(n2 / Int36.BIT18);

            var m1d1 = n1d1 * n2d1;
            var m1d2 = (n1d2 * n2d1) + Math.trunc(m1d1 / Int36.BIT18);
            extended = Math.trunc(m1d2 / Int36.BIT18);
            m1d2 = (m1d2 % Int36.BIT18) + (n1d1 * n2d2);
            value = (m1d2 * Int36.BIT18) + (m1d1 % Int36.BIT18);
            extended += Math.trunc(m1d2 / Int36.BIT18) + (n1d2 * n2d2);
        }

        this.value = this.truncate(value);
        this.extended = this.truncate(extended);

        if (fNeg) {
            this.negate();
        }
    }

    /**
     * div(i36)
     *
     * @this {Int36}
     * @param {Int36} i36
     */
    div(i36)
    {
        this.divExtended(i36.value);
    }

    /**
     * divNum(num)
     *
     * @this {Int36}
     * @param {number} num
     */
    divNum(num)
    {
        this.divExtended(Int36.validate(num));
    }

    /**
     * divExtended(divisor)
     *
     * @this {Int36}
     * @param {number} divisor
     */
    divExtended(divisor)
    {
        /*
         * NOTE: A divisor of zero is always a bad idea; however, we no longer require the divisor to be
         * GREATER than the extended portion of the dividend, because toDecimal() needs to be able to divide
         * large 72-bit values by 10,000,000,000 without worrying about the size of the resulting quotient.
         *
         * For callers that can only support 36-bit results, they can either perform their own preliminary
         * check of the divisor against any dividend extension, or they can simply allow all divisions to
         * proceed, check for an extended quotient afterward, and record the appropriate error.
         */
        if (!divisor) {
            this.error |= Int36.ERROR.DIVZERO;
            return;
        }

        var fNegQ = false, fNegR = false;

        if (divisor > Int36.MAXPOS) {
            divisor = Int36.BIT36 - divisor;
            fNegQ = !fNegQ;
        }

        if (this.isNegative()) {
            this.negate();
            fNegR = true; fNegQ = !fNegQ;
        }

        var bitsRes = Int36.setBits(this.bitsRes, 0, 0);
        var bitsPow = Int36.setBits(this.bitsPow, 1, 0);
        var bitsDiv = Int36.setBits(this.bitsDiv, divisor, 0);
        var bitsRem = Int36.setBits(this.bitsRem, this.value, this.extended || 0);

        while (Int36.cmpBits(bitsRem, bitsDiv) > 0) {
            Int36.addBits(bitsDiv, bitsDiv);
            Int36.addBits(bitsPow, bitsPow);
        }
        do {
            if (Int36.cmpBits(bitsRem, bitsDiv) >= 0) {
                Int36.subBits(bitsRem, bitsDiv);
                Int36.addBits(bitsRes, bitsPow);
            }
            Int36.shrBits(bitsDiv);
            Int36.shrBits(bitsPow);
        } while (bitsPow[0] || bitsPow[1]);

        /*
         * NOTE: We no longer require bitsRes[1] to be zero (that is, we no longer require the quotient
         * to fit within the 36 bits of bitsRes[0]) because toDecimal() needs to be able to divide large
         * 72-bit values by 10,000,000,000 without worrying about the size of the resulting quotient.
         *
         * We do, however, still expect remainders to fit within the 36 bits of bitsRem[0], because our
         * divisors are limited to 36 bits as well.
         */
        if (DEBUG && bitsRem[1]) {
            console.log("divExtended() assertion failure");
        }

        this.value = bitsRes[0];
        this.extended = bitsRes[1];
        this.remainder = bitsRem[0];

        if (fNegQ) {
            this.negate();
        }

        if (fNegR && this.remainder) {
            this.remainder = Int36.BIT36 - this.remainder;
        }
    }

    /**
     * isNegative()
     *
     * @return {boolean}
     */
    isNegative()
    {
        return (this.extended > Int36.MAXPOS || this.extended == null && this.value > Int36.MAXPOS);
    }

    /**
     * negate()
     */
    negate()
    {
        if (this.extended == null) {
            /*
             * Set extended to match the sign of the (negated) value.
             */
            this.extended = (this.value > Int36.MAXPOS? 0 : Int36.MAXVAL);
        }
        else if (this.value) {
            /*
             * Perform one's complement on the extended value.
             */
            this.extended = Int36.MAXVAL - this.extended;
        }
        else {
            /*
             * Perform two's complement on the extended value.
             */
            if (this.extended) this.extended = Int36.BIT36 - this.extended;
        }
        /*
         * Perform two's complement on the value.
         */
        if (this.value) this.value = Int36.BIT36 - this.value;
        this.error = Int36.ERROR.NONE;
    }

    /**
     * addBits(bitsDst, bitsSrc)
     *
     * Adds bitsSrc to bitsDst.
     *
     * @param {Array.<number>} bitsDst
     * @param {Array.<number>} bitsSrc
     */
    static addBits(bitsDst, bitsSrc)
    {
        bitsDst[0] += bitsSrc[0];
        bitsDst[1] += bitsSrc[1];
        if (bitsDst[0] >= Int36.BIT36) {
            bitsDst[0] %= Int36.BIT36;
            bitsDst[1]++;
        }
    }

    /**
     * cmpBits(bitsDst, bitsSrc)
     *
     * Compares bitsDst to bitsSrc, by computing bitsDst - bitsSrc.
     *
     * @param {Array.<number>} bitsDst
     * @param {Array.<number>} bitsSrc
     * @return {number} > 0 if bitsDst > bitsSrc, == 0 if bitsDst == bitsSrc, < 0 if bitsDst < bitsSrc
     */
    static cmpBits(bitsDst, bitsSrc)
    {
        var result = bitsDst[1] - bitsSrc[1];
        if (!result) result = bitsDst[0] - bitsSrc[0];
        return result;
    }

    /**
     * setBits(bits, lo, hi)
     *
     * @param {Array.<number>} bits
     * @param {number} lo
     * @param {number} hi
     * @return {Array.<number>}
     */
    static setBits(bits, lo, hi)
    {
        bits[0] = lo;
        bits[1] = hi;
        return bits;
    }

    /**
     * shrBits(bitsDst)
     *
     * Shifts bitsDst right one bit.
     *
     * @param {Array.<number>} bitsDst
     */
    static shrBits(bitsDst)
    {
        if (bitsDst[1] % 2) {
            bitsDst[0] += Int36.BIT36;
        }
        bitsDst[0] = Math.trunc(bitsDst[0] / 2);
        bitsDst[1] = Math.trunc(bitsDst[1] / 2);
    }

    /**
     * subBits(bitsDst, bitsSrc)
     *
     * Subtracts bitsSrc from bitsDst.
     *
     * @param {Array.<number>} bitsDst
     * @param {Array.<number>} bitsSrc
     */
    static subBits(bitsDst, bitsSrc)
    {
        bitsDst[0] -= bitsSrc[0];
        bitsDst[1] -= bitsSrc[1];
        if (bitsDst[0] < 0) {
            bitsDst[0] += Int36.BIT36;
            bitsDst[1]--;
        }
    }

    /**
     * octal(value)
     *
     * @param {number} value
     * @return {string}
     */
    static octal(value)
    {
        if (value < 0) value += Int36.BIT36;
        return ("00000000000" + value.toString(8)).slice(-12);
    }

    /**
     * validate(num)
     *
     * This ensures that any incoming (external) 36-bit values conform to our internal requirements.
     *
     * @param {number} num
     * @return {number}
     */
    static validate(num)
    {
        /*
         * Although it's expected that most callers will supply unsigned 36-bit values, we're nice about
         * converting any signed values to their unsigned (two's complement) counterpart, provided they are
         * within the acceptable range.  Any signed values outside that range will be dealt with afterward.
         */
        if (num < 0 && num >= Int36.MINNEG) {
            num += Int36.BIT36;
        }
        var value = Math.trunc(Math.abs(num)) % Int36.BIT36;
        if (DEBUG && num !== value) {
            console.log("Int36.validate(" + num + " out of range, truncated to " + value + ")");
        }
        return value;
    }
}

Int36.ERROR = {
    NONE:       0x0,
    OVERFLOW:   0x1,
    UNDERFLOW:  0x2,
    DIVZERO:    0x4
};

Int36.BIT18     =  Math.pow(2, 18);     //         262,144
Int36.BIT35     =  Math.pow(2, 35);     //  34,359,738,368 (aka the sign bit)
Int36.BIT36     =  Math.pow(2, 36);     //  68,719,476,736

Int36.MAXPOS    =  Math.pow(2, 35) - 1; //  34,359,738,367
Int36.MINNEG    = -Math.pow(2, 35);     // -34,359,738,368

Int36.MAXVAL    =  Math.pow(2, 36) - 1; //  68,719,476,735

if (NODE) module.exports = Int36;