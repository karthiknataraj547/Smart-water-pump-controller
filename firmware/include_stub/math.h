#pragma once
#ifndef _MATH_H_STUB
#define _MATH_H_STUB

#ifdef __cplusplus
extern "C" {
#endif

double pow(double base, double exp);
double fabs(double x);
float fabsf(float x);
double sqrt(double x);
float sqrtf(float x);
double sin(double x);
double cos(double x);
double tan(double x);
double floor(double x);
double ceil(double x);
double round(double x);
float floorf(float x);
float ceilf(float x);
float roundf(float x);

#define NAN (__builtin_nan(""))
#define INFINITY (__builtin_inf())
#define isnan(x) __builtin_isnan(x)
#define isinf(x) __builtin_isinf(x)

#ifdef __cplusplus
}

inline float abs(float x) { return x < 0.0f ? -x : x; }
inline double abs(double x) { return x < 0.0 ? -x : x; }
#endif

#endif // _MATH_H_STUB
