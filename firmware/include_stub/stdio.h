#pragma once
#ifndef _STDIO_H_STUB
#define _STDIO_H_STUB

#include "stddef.h"

#ifdef __cplusplus
extern "C" {
#endif

int printf(const char *format, ...);
int sprintf(char *str, const char *format, ...);
int snprintf(char *str, size_t size, const char *format, ...);
int sscanf(const char *str, const char *format, ...);
int puts(const char *str);
int putchar(int c);

#ifdef __cplusplus
}
#endif

#endif // _STDIO_H_STUB
