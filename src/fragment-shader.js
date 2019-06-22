export var fragmentShader = `precision highp float;
uniform mat4 worldView;
varying vec4 vPosition;
varying vec3 vNormal;
uniform sampler2D textureSampler;
uniform sampler2D backgroundVideoTexture;
uniform sampler2D lyricsVideoTexture;
uniform sampler2D camera1Texture;
uniform sampler2D camera2Texture;

uniform float lyricsThreshold;
uniform float lyricsScale;
uniform float lyricsPositionX;
uniform float lyricsPositionY;

// Camera 1 params
uniform float camera1Threshold;
uniform vec3 camera1ThresholdColor;
uniform int camera1ApplyThresholdInt;

uniform float camera1Hue;
uniform float camera1Saturation;
uniform float camera1Brightness;
uniform float camera1Contrast;
uniform int camera1ApplyFiltersInt;

// Camera 2 params
uniform float camera2Threshold;
uniform vec3 camera2ThresholdColor;
uniform int camera2ApplyThresholdInt;

uniform float camera2Hue;
uniform float camera2Saturation;
uniform float camera2Brightness;
uniform float camera2Contrast;
uniform int camera2ApplyFiltersInt;

uniform int applyEffectInt;

uniform int transitionNumber;
uniform int effectNumber;
uniform float time;

uniform float cameraSelection;

#define NEffects 2

#define PI 3.141592653589
#define POW2(X) X*X
#define POW3(X) X*X*X
#define ratio 0.5


// zoom in from 0 to 1 ; after 1 everything will be inverted,
// zoom out from 1 to 2, no zoom at 2, then zoom out until infinity
// zoom out from 0 to - infinity
vec2 zoom(vec2 uv, float amount) {
  return 0.5 + ((uv - 0.5) * (1.0-amount));	
}

float rand(int num) {
  return fract(mod(float(num) * 67123.313, 12.0) * sin(float(num) * 10.3) * cos(float(num)));
}

float rand (vec2 co) {
  return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

vec4 hueSaturation(vec4 color, float hue, float saturation) {

	float angle = hue * 3.14159265;
	float s = sin(angle), c = cos(angle);
	
	vec3 weights = (vec3(2.0 * c, -sqrt(3.0) * s - c, sqrt(3.0) * s - c) + 1.0) / 3.0;
	
	float len = length(color.rgb);
	vec3 result = vec3( dot(color.rgb, weights.xyz), dot(color.rgb, weights.zxy), dot(color.rgb, weights.yzx) );
	float average = (result.r + result.g + result.b) / 3.0;

	if (saturation > 0.0) {
		result += (average - result.rgb) * (1.0 - 1.0 / (1.001 - saturation));
	} else {
		result += (average - result.rgb) * (-saturation);
	}

	return vec4(result, 1.0);
}

vec4 brightnessContrast(vec4 color, float brightness, float contrast) {
	vec4 result = color;
	result += brightness;
	
	if(contrast > 0.0) {
		result.rgb += (result.rgb - 0.5) / (1.0 - contrast) + 0.5;
	} else {
		result.rgb += (result.rgb - 0.5) * (1.0 + contrast) + 0.5;
	}
	return result;
}

vec4 preprocess(vec4 color, float hue, float saturation, float brightness, float contrast) {
	vec4 result = brightnessContrast(color, brightness, contrast);
	return hueSaturation(result, hue, saturation);
}

vec4 applyThreshold(vec4 colorToThreshold, vec4 colorToApply, float cameraThreshold, vec3 cameraThresholdColor) {
    float distToThresholdColor = length(colorToThreshold.xyz - cameraThresholdColor.xyz);
    colorToApply.a = distToThresholdColor > cameraThreshold ? 1.0 : 0.0;
    // colorToApply.a = smoothstep(0.0, cameraThreshold, distToThresholdColor);
    return colorToApply;
}

vec4 processCamera(vec4 color, bool applyFilters, float hue, float saturation, float brightness, float contrast, bool thresholdCamera, float cameraThreshold, vec3 cameraThresholdColor) {
    vec4 colorPreprocessed = (applyFilters || thresholdCamera) ? preprocess(color, hue, saturation, brightness, contrast) : color;
    vec4 colorThresholded = thresholdCamera ? applyThreshold(colorPreprocessed, (applyFilters ? colorPreprocessed : color), cameraThreshold, cameraThresholdColor) : colorPreprocessed;
    return colorThresholded;
}

float quantizeTime(float duration, float nSteps) {
	return floor(mod(time, duration) * nSteps / duration);
}

vec4 effectJumpCut(sampler2D cameraTexture, vec2 p, bool thresholdCamera, vec3 cameraThresholdColor) {
	float duration = 2.5;
	float nSteps = 13.0;
	float maxZoom = 3.0;
	float offsetAmount = 0.5;
	float slideAmount = 0.2;

	float quantizedTime = quantizeTime(duration, nSteps);
	
	float slideTime = slideAmount * mod(time, duration / nSteps) / (duration / nSteps);
	
	float quantizedTimeLong = quantizeTime(duration*nSteps, nSteps);

	float randSeed = quantizedTimeLong + quantizedTime;

	float rx = rand(int(randSeed));
	float ry = 0.0;
	// float rx = quantizedTimeLong / nSteps;
	// float ry = quantizedTime / nSteps;

	// vec2 offset = vec2(rx, ry) - 0.5;
	quantizedTime += slideTime;

	quantizedTime /= nSteps;
	quantizedTime = 1.0 - quantizedTime;
	vec2 offset = offsetAmount * quantizedTime * (vec2(rx, ry) - 0.5);

	quantizedTime *= maxZoom;
	// return texture2D(cameraTexture, p * quantizedTime + offset);
	
	p.y += 0.5 * quantizedTime / maxZoom;
	vec2 pCentered = p-0.5;
	vec2 newPositionCentered = pCentered * quantizedTime + offset;
	vec2 newPosition = newPositionCentered + 0.5;
	
	bool outside = abs(newPositionCentered.x) > 0.5 || abs(newPositionCentered.y) > 0.5;
	
	vec4 backgroundColor = thresholdCamera ? vec4(cameraThresholdColor, 1.0) : vec4(0.0);
	return outside ? backgroundColor : texture2D(cameraTexture, newPosition);
}

float toBezier(float t, vec2 P1, vec2 P2) {
	vec2 P0 = vec2(0.0, 0.0);
	vec2 P3 = vec2(1.0, 1.0);
    float t2 = t * t;
    float one_minus_t = 1.0 - t;
    float one_minus_t2 = one_minus_t * one_minus_t;
    return (P0 * one_minus_t2 * one_minus_t + P1 * 3.0 * t * one_minus_t2 + P2 * 3.0 * t2 * one_minus_t + P3 * t2 * t).y;
}

float toBezier(float t, float p1x, float p1y, float p2x, float p2y) {
	return toBezier(t, vec2(p1x, p1y), vec2(p2x, p2y));
}

vec4 effectZoom(sampler2D cameraTexture, vec2 p, bool thresholdCamera) {
	float duration = 1.5;
	float t = mod(time, duration) / duration;
	float zoomMin = -1.5;
	float zoomMax = 0.5;
	float zoomAmplitude = zoomMax - zoomMin;
	// float amount = zoomAmplitude * toBezier(t, .71,.16,.48,1.72) + zoomMin;
	float amount = zoomAmplitude * toBezier(t, .73,1.44,.7,1.51) / 1.3 + zoomMin;
	
	vec2 pZoomed = zoom(p, amount);
	return texture2D(cameraTexture, pZoomed);
}

vec4 applyEffect(sampler2D cameraTexture, vec2 p, bool thresholdCamera, vec3 cameraThresholdColor) {
	vec4 color = vec4(0.0);
	if (applyEffectInt > 0 && effectNumber < NEffects) {
		if(effectNumber == 0) {
			color = effectJumpCut(cameraTexture, p, thresholdCamera, cameraThresholdColor);
		} else if(effectNumber == 1) {
			color = effectZoom(cameraTexture, p, thresholdCamera);
		}
	} else {
		color = texture2D(cameraTexture, p);
	}
	return  color;
}

vec4 getFromColor(vec2 uv) {
	bool thresholdCamera = camera1ApplyThresholdInt > 0;
	bool applyFilter = camera1ApplyFiltersInt > 0;
    vec4 camera1 = applyEffect(camera1Texture, uv, thresholdCamera, camera1ThresholdColor);
    vec4 camera1Processed = processCamera(camera1, applyFilter, camera1Hue, camera1Saturation, camera1Brightness, camera1Contrast, thresholdCamera, camera1Threshold, camera1ThresholdColor);
    return camera1Processed;
}

vec4 getToColor(vec2 uv) {
	bool thresholdCamera = camera2ApplyThresholdInt > 0;
	bool applyFilter = camera2ApplyFiltersInt > 0;
    vec4 camera2 = applyEffect(camera2Texture, uv, thresholdCamera, camera2ThresholdColor);
    vec4 camera2Processed = processCamera(camera2, applyFilter, camera2Hue, camera2Saturation, camera2Brightness, camera2Contrast, thresholdCamera, camera1Threshold, camera2ThresholdColor);
    return camera2Processed;
}


vec4 zoomTransition(vec2 uv) {
	float zoom_quickness = 0.8;
	float nQuick = clamp(zoom_quickness, 0.2, 1.0);
	return mix(
		getFromColor(zoom(uv, smoothstep(0.0, nQuick, cameraSelection))),
		getToColor(uv),
		smoothstep(nQuick - 0.2, 1.0, cameraSelection)
	);
}

vec4 transitionDirectional(vec2 uv, vec2 direction) {
	vec2 p = uv + cameraSelection * sign(direction);
	vec2 f = fract(p);
	return mix(
		getToColor(f),
		getFromColor(f),
		step(0.0, p.y) * step(p.y, 1.0) * step(0.0, p.x) * step(p.x, 1.0)
	);
}

vec4 transitionSlice (vec2 p, float count, float smoothness) {
  float pr = smoothstep(-smoothness, 0.0, p.x - cameraSelection * (1.0 + smoothness));
  float s = step(pr, fract(count * p.x));
  return mix(getFromColor(p), getToColor(p), s);
}

vec4 transitionWaterDrop(vec2 p, float amplitude, float speed) {
  vec2 dir = p - vec2(.5);
  float dist = length(dir);

  if (dist > cameraSelection) {
    return mix(getFromColor( p), getToColor( p), cameraSelection);
  } else {
    vec2 offset = dir * sin(dist * amplitude - cameraSelection * speed);
    return mix(getFromColor( p + offset), getToColor( p), cameraSelection);
  }
}


float wave(int num, float frequency, int bars) {
  float fn = float(num) * frequency * 0.1 * float(bars);
  return cos(fn * 0.5) * cos(fn * 0.13) * sin((fn+10.0) * 0.3) / 2.0 + 0.5;
}

float drip(int num, int bars, float dripScale) {
  return sin(float(num) / float(bars - 1) * 3.141592) * dripScale;
}

float pos(int num, float noise, float frequency, int bars, float dripScale) {
  return (noise == 0.0 ? wave(num, frequency, bars) : mix(wave(num, frequency, bars), rand(num), noise)) + (dripScale == 0.0 ? 0.0 : drip(num, bars, dripScale));
}

vec4 transitionBars(vec2 uv, int bars, float amplitude, float noise, float frequency, float dripScale) {

  int bar = int(uv.x * (float(bars)));
  float scale = 1.0 + pos(bar, noise, frequency, bars, dripScale) * amplitude;
  float phase = cameraSelection * scale;
  float posY = uv.y / vec2(1.0).y;
  vec2 p;
  vec4 c;
  if (phase + posY < 1.0) {
    p = vec2(uv.x, uv.y + mix(0.0, vec2(1.0).y, phase)) / vec2(1.0).xy;
    c = getFromColor(p);
  } else {
    p = uv.xy / vec2(1.0).xy;
    c = getToColor(p);
  }

  // Finally, apply the color
  return c;
}


vec4 transitionPinWheel(vec2 uv, float speed) {
  
  vec2 p = uv.xy / vec2(1.0).xy;
  
  float circPos = atan(p.y - 0.5, p.x - 0.5) + cameraSelection * speed;
  float modPos = mod(circPos, 3.1415 / 4.);
  float signed = sign(cameraSelection - modPos);
  
  return mix(getToColor(p), getFromColor(p), step(signed, 0.5));
  
}

vec4 transitionAngular (vec2 uv, float startingAngle) {
  
  float offset = startingAngle * PI / 180.0;
  float angle = atan(uv.y - 0.5, uv.x - 0.5) + offset;
  float normalizedAngle = (angle + PI) / (2.0 * PI);
  
  normalizedAngle = normalizedAngle - floor(normalizedAngle);

  return mix(
    getFromColor(uv),
    getToColor(uv),
    step(normalizedAngle, cameraSelection)
    );
}

vec4 transitionColorPhase(vec2 uv) {
	vec4 fromStep = vec4(0.0, 0.2, 0.4, 0.0);
	vec4 toStep = vec4(0.6, 0.8, 1.0, 1.0);

	vec4 a = getFromColor(uv);
	vec4 b = getToColor(uv);
	return mix(a, b, smoothstep(fromStep, toStep, vec4(cameraSelection)));
}

vec4 transitionCircle(vec2 uv) {
  
  vec2 center = vec2(0.5, 0.5);
  vec3 backColor = vec3(0.1, 0.1, 0.1);

  float distance = length(uv - center);
  float radius = sqrt(8.0) * abs(cameraSelection - 0.5);
  
  if (distance > radius) {
    return vec4(backColor, 1.0);
  }
  else {
    if (cameraSelection < 0.5) return getFromColor(uv);
    else return getToColor(uv);
  }
}


vec2 project (vec2 p, float floating) {
  return p * vec2(1.0, -1.2) + vec2(0.0, -floating/100.);
}

bool inBounds (vec2 p) {
  return all(lessThan(vec2(0.0), p)) && all(lessThan(p, vec2(1.0)));
}

vec4 bgColor (vec2 p, vec2 pfr, vec2 pto, float reflection, float floating) {
  vec4 c = vec4(0.0, 0.0, 0.0, 1.0);
  pfr = project(pfr, floating);
  // FIXME avoid branching might help perf!
  if (inBounds(pfr)) {
    c += mix(vec4(0.0), getFromColor(pfr), reflection * mix(1.0, 0.0, pfr.y));
  }
  pto = project(pto, floating);
  if (inBounds(pto)) {
    c += mix(vec4(0.0), getToColor(pto), reflection * mix(1.0, 0.0, pto.y));
  }
  return c;
}

// p : the position
// persp : the perspective in [ 0, 1 ]
// center : the xcenter in [0, 1] \ 0.5 excluded
vec2 xskew (vec2 p, float persp, float center) {
  float x = mix(p.x, 1.0-p.x, center);
  return (
    (
      vec2( x, (p.y - 0.5*(1.0-persp) * x) / (1.0+(persp-1.0)*x) )
      - vec2(0.5-distance(center, 0.5), 0.0)
    )
    * vec2(0.5 / distance(center, 0.5) * (center<0.5 ? 1.0 : -1.0), 1.0)
    + vec2(center<0.5 ? 0.0 : 1.0, 0.0)
  );
}

vec4 transitionCube(vec2 op) {

  float persp = 0.7;
  float unzoom = 0.3;
  float reflection = 0.4;
  float floating = 3.0;

  float uz = unzoom * 2.0*(0.5-distance(0.5, cameraSelection));
  vec2 p = -uz*0.5+(1.0+uz) * op;
  vec2 fromP = xskew(
    (p - vec2(cameraSelection, 0.0)) / vec2(1.0-cameraSelection, 1.0),
    1.0-mix(cameraSelection, 0.0, persp),
    0.0
  );
  vec2 toP = xskew(
    p / vec2(cameraSelection, 1.0),
    mix(pow(cameraSelection, 2.0), 1.0, persp),
    1.0
  );
  // FIXME avoid branching might help perf!
  if (inBounds(fromP)) {
    return getFromColor(fromP);
  }
  else if (inBounds(toP)) {
    return getToColor(toP);
  }
  return bgColor(op, fromP, toP, reflection, floating);
}


vec2 project2 (vec2 p) {
  return p * vec2(1.0, -1.2) + vec2(0.0, -0.02);
}

vec4 bgColor (vec2 p, vec2 pto, float reflection) {
  vec4 c = vec4(0.0);
  pto = project2(pto);
  if (inBounds(pto)) {
    c += mix(c, getToColor(pto), reflection * mix(1.0, 0.0, pto.y));
  }
  return c;
}


vec4 transitionDoorWay (vec2 p) {

  float reflection = 0.4;
  float perspective = 0.4;
  float depth = 3.0;

  const vec4 black = vec4(0.0, 0.0, 0.0, 0.0);
  const vec2 boundMin = vec2(0.0, 0.0);
  const vec2 boundMax = vec2(1.0, 1.0);

  vec2 pfr = vec2(-1.), pto = vec2(-1.);
  float middleSlit = 2.0 * abs(p.x-0.5) - cameraSelection;
  if (middleSlit > 0.0) {
    pfr = p + (p.x > 0.5 ? -1.0 : 1.0) * vec2(0.5*cameraSelection, 0.0);
    float d = 1.0/(1.0+perspective*cameraSelection*(1.0-middleSlit));
    pfr.y -= d/2.;
    pfr.y *= d;
    pfr.y += d/2.;
  }
  float size = mix(1.0, depth, 1.-cameraSelection);
  pto = (p + vec2(-0.5, -0.5)) * vec2(size, size) + vec2(0.5, 0.5);
  if (inBounds(pfr)) {
    return getFromColor(pfr);
  }
  else if (inBounds(pto)) {
    return getToColor(pto);
  }
  else {
    return bgColor(p, pto, reflection);
  }
}

float inHeart (vec2 p, vec2 center, float size) {
  if (size==0.0) return 0.0;
  vec2 o = (p-center)/(1.6*size);
  float a = o.x*o.x+o.y*o.y-0.3;
  return step(a*a*a, o.x*o.x*o.y*o.y*o.y);
}

vec4 transitionHeart (vec2 uv) {
  return mix(
    getFromColor(uv),
    getToColor(uv),
    inHeart(uv, vec2(0.5, 0.4), cameraSelection)
  );
}


vec4 transitionPixelize(vec2 uv) {

  int steps = 50; // zero disable the stepping
  ivec2 squaresMin = ivec2(20); // minimum number of squares (when the effect is at its higher level)
  float d = min(cameraSelection, 1.0 - cameraSelection);
  float dist = steps>0 ? ceil(d * float(steps)) / float(steps) : d;
  vec2 squareSize = 2.0 * dist / vec2(squaresMin);
  
  

  vec2 p = dist>0.0 ? (floor(uv / squareSize) + 0.5) * squareSize : uv;
  return mix(getFromColor(p), getToColor(p), cameraSelection);
}


vec4 transitionRotateScaleFade(vec2 uv) {
  
  vec2 center = vec2(0.5, 0.5);
  float rotations = 1.0;
  float scale = 8.0;
  vec4 backColor = vec4(0.15, 0.15, 0.15, 1.0);

  vec2 difference = uv - center;
  vec2 dir = normalize(difference);
  float dist = length(difference);
  
  float angle = 2.0 * PI * rotations * cameraSelection;
  
  float c = cos(angle);
  float s = sin(angle);
  
  float currentScale = mix(scale, 1.0, 2.0 * abs(cameraSelection - 0.5));
  
  vec2 rotatedDir = vec2(dir.x  * c - dir.y * s, dir.x * s + dir.y * c);
  vec2 rotatedUv = center + rotatedDir * dist / currentScale;
  
  if (rotatedUv.x < 0.0 || rotatedUv.x > 1.0 ||
      rotatedUv.y < 0.0 || rotatedUv.y > 1.0)
    return backColor;
    
  return mix(getFromColor(rotatedUv), getToColor(rotatedUv), cameraSelection);
}


vec4 transitionCircleCrop(vec2 p) {
  vec2 ratio2 = vec2(1.0, 1.0 / 0.5);
  float s = pow(2.0 * abs(cameraSelection - 0.5), 3.0);
  vec4 bgcolor = vec4(0.0, 0.0, 0.0, 1.0);
  float dist = length((vec2(p) - 0.5) * ratio2);
  return mix(
    cameraSelection < 0.5 ? getFromColor(p) : getToColor(p), // branching is ok here as we statically depend on cameraSelection uniform (branching won't change over pixels)
    bgcolor,
    step(s, dist)
  );
}

vec4 transitionColorDistance(vec2 p) {
  float power = 5.0;
  vec4 fTex = getFromColor(p);
  vec4 tTex = getToColor(p);
  float m = step(distance(fTex, tTex), cameraSelection);
  return mix(
    mix(fTex, tTex, m),
    tTex,
    pow(cameraSelection, power)
  );
}

vec4 transitionSwirl(vec2 UV)
{
	float Radius = 1.0;

	float T = cameraSelection;

	UV -= vec2( 0.5, 0.5 );

	float Dist = length(UV);

	if ( Dist < Radius )
	{
		float Percent = (Radius - Dist) / Radius;
		float A = ( T <= 0.5 ) ? mix( 0.0, 1.0, T/0.5 ) : mix( 1.0, 0.0, (T-0.5)/0.5 );
		float Theta = Percent * Percent * A * 8.0 * 3.14159;
		float S = sin( Theta );
		float C = cos( Theta );
		UV = vec2( dot(UV, vec2(C, -S)), dot(UV, vec2(S, C)) );
	}
	UV += vec2( 0.5, 0.5 );

	vec4 C0 = getFromColor(UV);
	vec4 C1 = getToColor(UV);

	return mix( C0, C1, T );
}

vec2 offset(float cameraSelection, float x, float theta) {
  float phase = cameraSelection*cameraSelection + cameraSelection + theta;
  float shifty = 0.03*cameraSelection*cos(10.0*(cameraSelection+x));
  return vec2(0, shifty);
}
vec4 transitionDreamy(vec2 p) {
  return mix(getFromColor(p + offset(cameraSelection, p.x, 0.0)), getToColor(p + offset(1.0-cameraSelection, p.x, 3.14)), cameraSelection);
}


float Linear_ease(in float begin, in float change, in float duration, in float easeTime) {
    return change * easeTime / duration + begin;
}

float Exponential_easeInOut(in float begin, in float change, in float duration, in float easeTime) {
    if (easeTime == 0.0)
        return begin;
    else if (easeTime == duration)
        return begin + change;
    easeTime = easeTime / (duration / 2.0);
    if (easeTime < 1.0)
        return change / 2.0 * pow(2.0, 10.0 * (easeTime - 1.0)) + begin;
    return change / 2.0 * (-pow(2.0, -10.0 * (easeTime - 1.0)) + 2.0) + begin;
}

float Sinusoidal_easeInOut(in float begin, in float change, in float duration, in float easeTime) {
    return -change / 2.0 * (cos(PI * easeTime / duration) - 1.0) + begin;
}


vec3 crossFade(in vec2 uv, in float dissolve) {
    return mix(getFromColor(uv).rgb, getToColor(uv).rgb, dissolve);
}

vec4 transitionCrossZoom(vec2 uv) {
	float strength = 0.4;
    vec2 texCoord = uv.xy / vec2(1.0).xy;

    // Linear interpolate center across center half of the image
    vec2 center = vec2(Linear_ease(0.25, 0.5, 1.0, cameraSelection), 0.5);
    float dissolve = Exponential_easeInOut(0.0, 1.0, 1.0, cameraSelection);

    // Mirrored sinusoidal loop. 0->strength then strength->0
    float strength2 = Sinusoidal_easeInOut(0.0, strength, 0.5, cameraSelection);

    vec3 color = vec3(0.0);
    float total = 0.0;
    vec2 toCenter = center - texCoord;

    /* randomize the lookup values to hide the fixed number of samples */
    float offset = rand(uv);

    for (float t = 0.0; t <= 40.0; t++) {
        float percent = (t + offset) / 40.0;
        float weight = 4.0 * (percent - percent * percent);
        color += crossFade(texCoord + toCenter * percent * strength2, dissolve) * weight;
        total += weight;
    }
    return vec4(color / total, 1.0);
}


float Rand(vec2 v) {
  return fract(sin(dot(v.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

vec2 Rotate(vec2 v, float a) {
  mat2 rm = mat2(cos(a), -sin(a),
                 sin(a), cos(a));
  return rm*v;
}
float CosInterpolation(float x) {
  return -cos(x*PI)/2.+.5;
}

vec4 transitionMosaic(vec2 uv) {
  int endx = 2;
  int endy = -1;
  vec2 p = uv.xy / vec2(1.0).xy - .5;
  vec2 rp = p;
  float rpr = (cameraSelection*2.-1.);
  float z = -(rpr*rpr*2.) + 3.;
  float az = abs(z);
  rp *= az;
  rp += mix(vec2(.5, .5), vec2(float(endx) + .5, float(endy) + .5), POW2(CosInterpolation(cameraSelection)));
  vec2 mrp = mod(rp, 1.);
  vec2 crp = rp;
  bool onEnd = int(floor(crp.x))==endx&&int(floor(crp.y))==endy;
  if(!onEnd) {
    float ang = float(int(Rand(floor(crp))*4.))*.5*PI;
    mrp = vec2(.5) + Rotate(mrp-vec2(.5), ang);
  }
  if(onEnd || Rand(floor(crp))>.5) {
    return getToColor(mrp);
  } else {
    return getFromColor(mrp);
  }
}

vec4 transitionRadial(vec2 p) {
  float smoothness = 1.0;
  vec2 rp = p*2.-1.;
  return mix(
    getToColor(p),
    getFromColor(p),
    smoothstep(0., smoothness, atan(rp.y,rp.x) - (cameraSelection-.5) * PI * 2.5)
  );
}


void main() {
	vec2 uv = vPosition.xy + 0.5;

	vec4 lyricsBackgroundColor = texture2D(lyricsVideoTexture, vec2(0.0, 0.0));

	vec2 lyricsPosition = uv - 0.5;
	lyricsPosition -= vec2(lyricsPositionX, lyricsPositionY);
	lyricsPosition /= lyricsScale;
	bool lyricsOutside = abs(lyricsPosition.x) > 0.5 || abs(lyricsPosition.y) > 0.5;
	lyricsPosition += 0.5;
	vec4 lyricsColor = lyricsOutside ? lyricsBackgroundColor : texture2D(lyricsVideoTexture, lyricsPosition);
	vec4 background = texture2D(backgroundVideoTexture, uv);

	vec4 cameraColor = vec4(0.0);
	if(transitionNumber == 0) {
		cameraColor = zoomTransition(uv);
	} else if(transitionNumber == 1) {
		cameraColor = transitionDirectional(uv, vec2(1.0, 0.0));
	} else if(transitionNumber == 2) {
		cameraColor = transitionDirectional(uv, vec2(0.0, 1.0));
	} else if(transitionNumber == 3) {
		cameraColor = transitionDirectional(uv, vec2(0.5, 0.5));
	} else if(transitionNumber == 4) {
		cameraColor = transitionSlice(uv, 10.0, 0.5);
	} else if(transitionNumber == 5) {
		cameraColor = transitionSlice(uv, 25.0, 1.0);
	} else if(transitionNumber == 6) {
		cameraColor = transitionWaterDrop(uv, 30.0, 30.0);
	} else if(transitionNumber == 7) {
		cameraColor = transitionWaterDrop(uv, 10.0, 60.0);
	} else if(transitionNumber == 8) {
		cameraColor = transitionHeart(uv);
	} else if(transitionNumber == 9) {
		cameraColor = transitionBars(uv, 30, 2.0, 0.1, 0.5, 0.5);
	} else if(transitionNumber == 10) {
		cameraColor = transitionBars(uv, 60, 1.0, 0.5, 0.15, 0.85);
	} else if(transitionNumber == 11) {
		cameraColor = transitionPinWheel(uv, 2.0);
	} else if(transitionNumber == 12) {
		cameraColor = transitionAngular(uv, 90.0);
	} else if(transitionNumber == 13) {
		cameraColor = transitionColorPhase(uv);
	} else if(transitionNumber == 14) {
		cameraColor = transitionCircle(uv);
	} else if(transitionNumber == 15) {
		cameraColor = transitionCube(uv);
	} else if(transitionNumber == 16) {
		cameraColor = transitionDoorWay(uv);
	} else if(transitionNumber == 17) {
		cameraColor = transitionHeart(uv);
	}  else if(transitionNumber == 18) {
		cameraColor = transitionPixelize(uv);
	}  else if(transitionNumber == 19) {
		cameraColor = transitionRotateScaleFade(uv);
	}  else if(transitionNumber == 20) {
		cameraColor = transitionCircleCrop(uv);
	}  else if(transitionNumber == 21) {
		cameraColor = transitionColorDistance(uv);
	}  else if(transitionNumber == 22) {
		cameraColor = transitionSwirl(uv);
	}  else if(transitionNumber == 23) {
		cameraColor = transitionDreamy(uv);
	}  else if(transitionNumber == 24) {
		cameraColor = transitionCrossZoom(uv);
	}  else if(transitionNumber == 25) {
		cameraColor = transitionMosaic(uv);
	}  else if(transitionNumber == 26) {
		cameraColor = transitionRadial(uv);
	} else {
        discard;
	}

	vec4 cameraBackgroundColor = mix(background, cameraColor, cameraColor.a);

	float lyricsDistToBackground = length(lyricsColor.xyz - lyricsBackgroundColor.xyz);
	gl_FragColor = lyricsDistToBackground > lyricsThreshold ? lyricsColor : cameraBackgroundColor;
	// gl_FragColor = cameraColor;
}`;